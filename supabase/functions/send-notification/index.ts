import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { scheduleId, actionType, actorUserId, oldData } = await req.json()

    if (!scheduleId || !actionType || !actorUserId) {
      return new Response(
        JSON.stringify({ error: '필수 필드가 누락되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 환경변수
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Supabase Admin Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. 일정 정보 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      console.error('일정 조회 실패:', scheduleError)
      return new Response(
        JSON.stringify({ error: '일정을 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. 작성자(배우자) 정보 조회
    const { data: actor } = await supabase
      .from('users')
      .select('name')
      .eq('id', actorUserId)
      .single()

    const actorName = actor?.name || '알 수 없음'

    // 3. 알림 대상 사용자 조회 (카카오 토큰이 있는 모든 사용자)
    const { data: users } = await supabase
      .from('users')
      .select('id, kakao_access_token, kakao_refresh_token, kakao_token_expires_at')
      .not('kakao_access_token', 'is', null)

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: '알림 대상 사용자가 없습니다.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. 알림 설정 일괄 조회 (N+1 쿼리 최적화)
    const scheduleType = schedule.type // VACATION or WORK
    const actionLabel = actionType === 'CREATED' ? '등록' :
                        actionType === 'UPDATED' ? '수정' : '삭제'

    const userIds = users.map(u => u.id)
    const { data: allPrefs = [] } = await supabase
      .from('notification_preferences')
      .select('user_id, enabled')
      .in('user_id', userIds)
      .eq('schedule_type', scheduleType)
      .eq('action_type', actionType)

    // user_id → enabled 매핑 (O(1) 조회용)
    const prefMap = new Map(allPrefs.map(p => [p.user_id, p.enabled]))

    let sentCount = 0
    let failedCount = 0

    const KAKAO_CLIENT_ID = Deno.env.get('KAKAO_CLIENT_ID')!
    const KAKAO_CLIENT_SECRET = Deno.env.get('KAKAO_CLIENT_SECRET')!

    // 카카오 토큰 갱신 헬퍼
    const refreshKakaoToken = async (refreshToken: string) => {
      const res = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: KAKAO_CLIENT_ID,
          client_secret: KAKAO_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
      })
      if (!res.ok) return null
      return await res.json()
    }

    // 5. 각 사용자에게 알림 발송
    for (const user of users) {
      // 알림 설정 확인
      const isEnabled = prefMap.get(user.id) !== false // 설정 없으면 true (기본값)
      if (!isEnabled) continue

      // 토큰 만료 확인 및 갱신 (만료 5분 전 이내면 갱신)
      let accessToken = user.kakao_access_token
      if (user.kakao_token_expires_at) {
        const expiresAt = new Date(user.kakao_token_expires_at).getTime()
        const now = Date.now()
        if (expiresAt - now < 5 * 60 * 1000 && user.kakao_refresh_token) {
          console.log(`토큰 만료 임박, 갱신 시도 (user: ${user.id})`)
          const refreshed = await refreshKakaoToken(user.kakao_refresh_token)
          if (refreshed?.access_token) {
            accessToken = refreshed.access_token
            const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 21600) * 1000).toISOString()
            await supabase.from('users').update({
              kakao_access_token: accessToken,
              kakao_token_expires_at: newExpiresAt,
              ...(refreshed.refresh_token ? { kakao_refresh_token: refreshed.refresh_token } : {}),
            }).eq('id', user.id)
            console.log(`토큰 갱신 완료 (user: ${user.id})`)
          } else {
            console.error(`토큰 갱신 실패 (user: ${user.id})`)
          }
        }
      }

      // 메시지 생성 헬퍼
      const VACATION_LABEL: Record<string, string> = {
        FULL: '휴가(일반)',
        HALF_AM: '휴가(오전 반차)',
        HALF_PM: '휴가(오후 반차)',
      }
      const getTypeLabel = (type: string, vacationType?: string) =>
        type === 'VACATION' ? (VACATION_LABEL[vacationType || 'FULL'] || '휴가') : '업무'

      const formatDate = (isoStr: string) => new Date(isoStr).toLocaleDateString('ko-KR')
      const formatDateRange = (start: string, end: string) => {
        const s = formatDate(start)
        const e = formatDate(end)
        return s === e ? s : `${s} ~ ${e}`
      }

      const newDateStr = formatDateRange(schedule.start_at, schedule.end_at)

      let message = `📅 [일정 ${actionLabel}]\n`
      if (scheduleType !== 'VACATION') message += `작성자: ${actorName}\n`
      message += `${schedule.title}\n`

      if (actionType === 'UPDATED' && oldData) {
        const oldTypeLabel = getTypeLabel(oldData.type, oldData.vacationType)
        const newTypeLabel = getTypeLabel(schedule.type, schedule.vacation_type)
        const oldDateStr = formatDateRange(oldData.startAt, oldData.endAt)

        const changes: string[] = []
        if (oldTypeLabel !== newTypeLabel) {
          changes.push(`유형: ${oldTypeLabel} → ${newTypeLabel}`)
        }
        if (oldDateStr !== newDateStr) {
          changes.push(`일자: ${oldDateStr} → ${newDateStr}`)
        }

        if (changes.length > 0) {
          message += changes.join('\n')
        } else {
          message += newDateStr
        }
      } else {
        message += newDateStr
        if (!schedule.all_day) {
          const startTime = new Date(schedule.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          const endTime = new Date(schedule.end_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          message += `\n${startTime} ~ ${endTime}`
        }
      }

      // 카카오 나에게 보내기 API 호출
      try {
        const templateObject = JSON.stringify({
          object_type: 'text',
          text: message,
          link: { web_url: '', mobile_web_url: '' },
        })

        const kakaoResponse = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`,
          },
          body: `template_object=${encodeURIComponent(templateObject)}`,
        })

        // 카카오 응답 파싱 (성공/실패 모두)
        let kakaoResult: Record<string, unknown> = {}
        try {
          kakaoResult = await kakaoResponse.json()
        } catch {
          kakaoResult = {}
        }

        console.log(`카카오 API 응답 (user: ${user.id}):`, {
          status: kakaoResponse.status,
          ok: kakaoResponse.ok,
          result: kakaoResult,
        })

        // result_code 0 = 성공, 나머지 = 실패
        const isSuccess = kakaoResponse.ok && kakaoResult.result_code === 0

        let notifMessage = message
        if (!isSuccess) {
          notifMessage = `[KAKAO_ERROR status:${kakaoResponse.status} result_code:${kakaoResult.result_code ?? 'N/A'} msg:${kakaoResult.msg ?? kakaoResult.error_description ?? 'unknown'}] | 원본: ${message}`
          console.error(`카카오 발송 실패 (user: ${user.id}):`, notifMessage)
        }

        // 알림 기록 저장
        await supabase.from('notifications').insert({
          schedule_id: scheduleId,
          user_id: user.id,
          type: `SCHEDULE_${actionType}`,
          channel: 'KAKAO',
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          message: notifMessage,
          sent_at: isSuccess ? new Date().toISOString() : null,
        })

        if (isSuccess) sentCount++
        else failedCount++
      } catch (err) {
        console.error(`사용자 ${user.id} 알림 발송 실패:`, err)
        failedCount++

        const errorMessage = `[ERROR] ${err instanceof Error ? err.message : String(err)} | 원본: ${message}`

        await supabase.from('notifications').insert({
          schedule_id: scheduleId,
          user_id: user.id,
          type: `SCHEDULE_${actionType}`,
          channel: 'KAKAO',
          status: 'FAILED',
          message: errorMessage,
        })
      }
    }

    // 6. 응답 반환
    return new Response(
      JSON.stringify({ sent: sentCount, failed: failedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('send-notification 에러:', error)
    return new Response(
      JSON.stringify({ error: '알림 처리 중 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
