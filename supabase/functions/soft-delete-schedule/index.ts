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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { scheduleId } = await req.json()

    if (!scheduleId) {
      return new Response(
        JSON.stringify({ error: '일정 ID가 필요합니다.' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Authorization 헤더로 요청자 검증
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다.' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    // 요청자 세션 검증 (Anon Client + 사용자 JWT)
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다.' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Admin Client (Service Role - RLS 우회)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 요청자의 users 테이블 ID 및 역할 조회
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // 일정 조회 (본인 일정 여부 확인)
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('schedules')
      .select('id, created_by, deleted_at')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      return new Response(
        JSON.stringify({ error: '일정을 찾을 수 없습니다.' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // 본인 일정이거나 Admin인 경우에만 삭제 가능
    if (schedule.created_by !== currentUser.id && currentUser.role !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: '본인이 등록한 일정만 삭제할 수 있습니다.' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // 이미 삭제된 일정 처리
    if (schedule.deleted_at) {
      return new Response(
        JSON.stringify({ error: '이미 삭제된 일정입니다.' }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Soft delete (Service Role - RLS 우회)
    const { error: deleteError } = await supabaseAdmin
      .from('schedules')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', scheduleId)

    if (deleteError) {
      console.error('soft delete 실패:', deleteError)
      return new Response(
        JSON.stringify({ error: '일정 삭제에 실패했습니다.' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    console.log('일정 soft delete 완료:', { scheduleId, userId: currentUser.id })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('soft-delete-schedule 에러:', error)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
