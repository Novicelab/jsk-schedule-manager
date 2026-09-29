import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWebPush, type PushSubscription, type VapidKeys } from '../_shared/webpush.ts'
import {
  APP_URL,
  ACTION_LABEL,
  buildPayload,
  type ScheduleRow,
} from '../_shared/notification-message.ts'

const ALLOWED_ORIGINS = [APP_URL, 'http://localhost:5173']

/**
 * 실제 푸시를 내보낼 수 있는 유일한 출처인지 판별한다.
 *
 * 로컬 개발 서버도 같은 Supabase 프로젝트를 보기 때문에, 막지 않으면 localhost 에서
 * 만든 테스트 일정이 실사용자 기기로 그대로 발송된다. 그래서 "운영 도메인에서 온
 * 요청만 발송" 으로 좁히고 나머지는 전부 dry-run 으로 돌린다.
 * (localhost, 127.0.0.1, LAN IP, preview 빌드, curl 이 한꺼번에 걸린다)
 *
 * Origin 은 브라우저가 채우는 값이라 페이지 스크립트가 바꿀 수 없다.
 * 프론트는 함수와 도메인이 달라 항상 cross-origin 이므로 이 헤더는 언제나 존재한다.
 */
const isProductionOrigin = (req: Request) => req.headers.get('origin') === APP_URL

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })

/* ── 핸들러 ────────────────────────────────────────────── */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return json(req, { error: '인증 토큰이 필요합니다.' }, 401)
    }

    const { scheduleId, actionType, oldData, forceSend } = await req.json()

    if (!scheduleId || !actionType) {
      return json(req, { error: '필수 필드가 누락되었습니다.' }, 400)
    }
    if (!ACTION_LABEL[actionType]) {
      return json(req, { error: '지원하지 않는 actionType 입니다.' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const vapidKeys: VapidKeys = {
      publicKey: (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim(),
      privateKey: (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim(),
      // RFC 8292: mailto: 또는 https: URL. 개인 연락처 대신 서비스 URL을 사용한다.
      subject: (Deno.env.get('VAPID_SUBJECT') || APP_URL).trim(),
    }

    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      console.error('VAPID 키가 설정되지 않았습니다.')
      return json(req, { error: '알림 서버 설정이 완료되지 않았습니다.' }, 500)
    }

    // 요청자 JWT 검증
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !authUser) {
      return json(req, { error: '유효하지 않은 인증 토큰입니다.' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 작성자는 클라이언트 입력이 아니라 토큰에서 확정한다 (본인 제외 로직의 신뢰 근거)
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, name')
      .eq('auth_id', authUser.id)
      .single()

    if (actorError || !actor) {
      console.error('작성자 조회 실패:', actorError)
      return json(req, { error: '사용자를 찾을 수 없습니다.' }, 404)
    }

    // 1. 일정 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('id, title, type, vacation_type, work_room, work_type, start_at, end_at, all_day')
      .eq('id', scheduleId)
      .single<ScheduleRow>()

    if (scheduleError || !schedule) {
      console.error('일정 조회 실패:', scheduleError)
      return json(req, { error: '일정을 찾을 수 없습니다.' }, 404)
    }

    // 2. 알림 문구 생성 — 발송 대상 조회보다 먼저 만든다.
    //    dry-run 일 때 대상이 없더라도 문구는 확인할 수 있어야 하기 때문이다.
    const payload = buildPayload(schedule, actionType, actor.name || '알 수 없음', oldData)

    // 운영 도메인이 아니면 발송하지 않는다. forceSend 는 비운영 요청에서만 인정하므로
    // 운영 동작에는 영향을 줄 수 없다 (로컬에서 실제 수신까지 확인할 때만 사용).
    const dryRun = !isProductionOrigin(req) && forceSend !== true

    const dryRunResponse = (wouldSend: number) => {
      console.log('[DRY-RUN] 비운영 요청이라 발송하지 않음:', {
        origin: req.headers.get('origin'),
        scheduleId,
        actionType,
        wouldSend,
        payload,
      })
      return json(req, {
        dryRun: true,
        payload,
        wouldSend,
        sent: 0,
        failed: 0,
        removed: 0,
        logged: false,
      })
    }

    // 3. 발송 대상 구독 조회 — 작성자 본인은 제외
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .neq('user_id', actor.id)

    if (subError) {
      console.error('구독 조회 실패:', subError)
      return json(req, { error: '알림 대상 조회에 실패했습니다.' }, 500)
    }

    if (!subscriptions || subscriptions.length === 0) {
      if (dryRun) return dryRunResponse(0)
      return json(req, { sent: 0, failed: 0, removed: 0, message: '알림 대상이 없습니다.' })
    }

    // 4. 알림 설정 일괄 조회 (행이 없으면 기본값 ON)
    const targetUserIds = [...new Set(subscriptions.map((s) => s.user_id))]
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, enabled')
      .in('user_id', targetUserIds)
      .eq('schedule_type', schedule.type)
      .eq('action_type', actionType)

    const disabledUsers = new Set(
      (prefs || []).filter((p) => p.enabled === false).map((p) => p.user_id),
    )

    const targets = subscriptions.filter((s) => !disabledUsers.has(s.user_id))

    // 5. 여기서부터가 실제 발송이다. 비운영 요청은 문구와 대상 수만 돌려주고 끝낸다.
    if (dryRun) return dryRunResponse(targets.length)

    // 6. 발송
    const payloadText = JSON.stringify(payload)

    let sent = 0
    let failed = 0
    const expiredIds: number[] = []
    const deliveredUsers = new Set<number>()
    const failedUsers = new Map<number, string>()

    const results = await Promise.all(
      targets.map(async (row) => {
        const subscription: PushSubscription = {
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
        }
        const result = await sendWebPush(subscription, payloadText, vapidKeys)
        return { row, result }
      }),
    )

    for (const { row, result } of results) {
      if (result.ok) {
        sent++
        deliveredUsers.add(row.user_id)
        continue
      }
      failed++
      failedUsers.set(row.user_id, `status:${result.status} ${result.error}`)
      if (result.expired) {
        expiredIds.push(row.id)
      } else {
        console.error(`푸시 발송 실패 (user: ${row.user_id}):`, result.status, result.error)
      }
    }

    // 7. 만료된 구독 정리 — 방치하면 매번 실패 로그만 쌓인다
    if (expiredIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds)
      if (cleanupError) {
        console.error('만료 구독 정리 실패:', cleanupError)
      } else {
        console.log(`만료 구독 ${expiredIds.length}건 삭제`)
      }
    }

    // 8. 알림 기록 (사용자 단위 1건) — 실패해도 발송 결과에 영향을 주지 않는다
    //
    // created_at 은 NOT NULL 인데 DB에 DEFAULT 가 없어 반드시 명시해야 한다.
    // (users 테이블도 같은 구조라 kakao-auth 에서 동일하게 명시하고 있다)
    const now = new Date().toISOString()

    const records = targetUserIds
      .filter((userId) => !disabledUsers.has(userId))
      .map((userId) => {
        const ok = deliveredUsers.has(userId)
        return {
          schedule_id: schedule.id,
          user_id: userId,
          type: `SCHEDULE_${actionType}`,
          channel: 'WEB_PUSH',
          status: ok ? 'SUCCESS' : 'FAILED',
          message: ok
            ? `${payload.title} | ${payload.body}`
            : `[PUSH_ERROR ${failedUsers.get(userId) || 'unknown'}] | 원본: ${payload.body}`,
          sent_at: ok ? now : null,
          created_at: now,
        }
      })

    let logged = true
    if (records.length > 0) {
      const { error: logError } = await supabase.from('notifications').insert(records)
      if (logError) {
        logged = false
        console.error('알림 기록 저장 실패(발송은 완료됨):', logError)
      }
    }

    console.log('푸시 발송 완료:', { scheduleId, actionType, sent, failed, logged })
    // logged 를 응답에 포함해 기록 실패가 조용히 묻히지 않게 한다
    return json(req, { sent, failed, removed: expiredIds.length, logged })
  } catch (error) {
    console.error('send-notification 에러:', error)
    return json(req, { error: '알림 처리 중 오류가 발생했습니다.' }, 500)
  }
})
