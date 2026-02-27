import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

interface NotificationPayload {
  scheduleId: number
  actionType: 'CREATED' | 'UPDATED' | 'DELETED'
  actorUserId: number
}

serve(async (req) => {
  // CORS preflight 응답
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    })
  }

  // JSON 파싱 전 요청 메서드 확인
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    )
  }

  try {
    const payload: NotificationPayload = await req.json()
    const { scheduleId, actionType, actorUserId } = payload

    // 필수 필드 검증
    if (!scheduleId || !actionType || !actorUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: scheduleId, actionType, actorUserId' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      )
    }

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
        { status: 404, headers: corsHeaders }
      )
    }

    // 2. 작성자 정보 조회
    const { data: actor } = await supabase
      .from('users')
      .select('name')
      .eq('id', actorUserId)
      .single()

    const actorName = actor?.name || '알 수 없음'

    // 3. 알림 대상 사용자 조회 (카카오 토큰이 있는 모든 사용자)
    const { data: users } = await supabase
      .from('users')
      .select('id, kakao_access_token')
      .not('kakao_access_token', 'is', null)

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: '알림 대상 사용자가 없습니다.' }),
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

    for (const user of users) {
      // 알림 설정 확인 (매핑에서 조회, DB 쿼리 없음)
      const isEnabled = prefMap.get(user.id) !== false // 설정 없으면 true (기본값)
      if (!isEnabled) continue

      // 메시지 생성 (개선된 형식)
      const startDate = new Date(schedule.start_at).toLocaleDateString('ko-KR')
      const endDate = new Date(schedule.end_at).toLocaleDateString('ko-KR')
      let message = `📅 [일정 ${actionLabel}]\n`
      message += `작성자: ${actor?.name || '작성자'}\n`
      message += `제목: ${schedule.title}\n`
      message += `일자: ${startDate}`
      if (startDate !== endDate) message += ` ~ ${endDate}`

      if (!schedule.all_day) {
        const startTime = new Date(schedule.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        const endTime = new Date(schedule.end_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        message += `\n시간: ${startTime} ~ ${endTime}`
      }

      // 카카오 나에게 보내기 API
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
            Authorization: `Bearer ${user.kakao_access_token}`,
          },
          body: `template_object=${encodeURIComponent(templateObject)}`,
        })

        // 카카오 응답 파싱 및 에러 원인 기록
        let notifMessage = message
        if (!kakaoResponse.ok) {
          try {
            const kakaoResult = await kakaoResponse.json()
            notifMessage = `[KAKAO_ERROR ${kakaoResponse.status}] ${kakaoResult.msg || kakaoResult.error_description || 'unknown'} | 원본: ${message}`
          } catch {
            notifMessage = `[KAKAO_ERROR ${kakaoResponse.status}] HTTP Error | 원본: ${message}`
          }
        }

        // 알림 기록 저장
        await supabase.from('notifications').insert({
          schedule_id: scheduleId,
          user_id: user.id,
          type: `SCHEDULE_${actionType}`,
          channel: 'KAKAO',
          status: kakaoResponse.ok ? 'SUCCESS' : 'FAILED',
          message: notifMessage,
          sent_at: kakaoResponse.ok ? new Date().toISOString() : null,
        })

        if (kakaoResponse.ok) sentCount++
        else failedCount++
      } catch (err) {
        console.error(`사용자 ${user.id} 알림 발송 실패:`, err)
        failedCount++

        await supabase.from('notifications').insert({
          schedule_id: scheduleId,
          user_id: user.id,
          type: `SCHEDULE_${actionType}`,
          channel: 'KAKAO',
          status: 'FAILED',
          message,
        })
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failedCount }),
      { status: 200, headers: corsHeaders }
    )
  } catch (error) {
    console.error('send-notification 에러:', error)
    return new Response(
      JSON.stringify({ error: '알림 처리 중 오류가 발생했습니다.', details: String(error) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
