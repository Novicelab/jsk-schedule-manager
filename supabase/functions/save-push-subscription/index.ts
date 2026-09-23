import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://jsk-schedule-frontend.onrender.com',
  'http://localhost:5173',
]

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return json(req, { error: '인증 토큰이 필요합니다.' }, 401)
    }

    const { action, subscription, userAgent } = await req.json()

    if (action !== 'save' && action !== 'delete') {
      return json(req, { error: '지원하지 않는 action 입니다.' }, 400)
    }
    if (!subscription?.endpoint) {
      return json(req, { error: '구독 정보가 없습니다.' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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

    // 토큰의 auth_id로 실제 사용자 행을 찾는다 (클라이언트가 보낸 userId를 신뢰하지 않음)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (userError || !user) {
      console.error('사용자 조회 실패:', userError)
      return json(req, { error: '사용자를 찾을 수 없습니다.' }, 404)
    }

    /* ── 구독 해제 ─────────────────────────────────────── */
    if (action === 'delete') {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('구독 삭제 실패:', deleteError)
        return json(req, { error: '알림 해제에 실패했습니다.' }, 500)
      }

      console.log('푸시 구독 삭제:', { userId: user.id })
      return json(req, { success: true })
    }

    /* ── 구독 저장 ─────────────────────────────────────── */
    if (!subscription.p256dh || !subscription.auth) {
      return json(req, { error: '구독 암호화 키가 없습니다.' }, 400)
    }

    // endpoint가 UNIQUE이므로 기기 재구독/계정 전환 시 소유자까지 갱신된다
    const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 100) : null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )

    if (upsertError) {
      console.error('구독 저장 실패:', upsertError)
      return json(req, { error: '알림 설정 저장에 실패했습니다.' }, 500)
    }

    console.log('푸시 구독 저장:', { userId: user.id, userAgent })
    return json(req, { success: true })
  } catch (error) {
    console.error('save-push-subscription 에러:', error)
    return json(req, { error: '구독 처리 중 오류가 발생했습니다.' }, 500)
  }
})
