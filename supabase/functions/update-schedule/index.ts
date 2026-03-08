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
    const { action, scheduleId, payload } = await req.json()

    // action 검증
    if (!action || !['create', 'update'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'action은 "create" 또는 "update"여야 합니다.' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'payload가 필요합니다.' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update' && !scheduleId) {
      return new Response(
        JSON.stringify({ error: '수정 시 scheduleId가 필요합니다.' }),
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

    // 요청자의 users 테이블 ID 조회 (auth_id -> users.id 매핑)
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // payload에서 허용된 필드만 추출 (인젝션 방지)
    const sanitizedPayload: Record<string, unknown> = {}
    const allowedFields = ['title', 'description', 'type', 'start_at', 'end_at', 'all_day', 'vacation_type']
    for (const field of allowedFields) {
      if (field in payload) {
        sanitizedPayload[field] = payload[field]
      }
    }

    // type 값 검증
    if (sanitizedPayload.type && !['VACATION', 'WORK'].includes(sanitizedPayload.type as string)) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 일정 유형입니다.' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // vacation_type 값 검증
    if (sanitizedPayload.vacation_type && !['FULL', 'HALF_AM', 'HALF_PM', 'EARLY_LEAVE'].includes(sanitizedPayload.vacation_type as string)) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 휴가 유형입니다.' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create') {
      // 생성: created_by를 서버에서 auth_id 기반으로 설정 (IDOR 방지)
      const insertData = {
        ...sanitizedPayload,
        created_by: currentUser.id,
      }

      const { data: newSchedule, error: insertError } = await supabaseAdmin
        .from('schedules')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('일정 생성 실패:', insertError)
        return new Response(
          JSON.stringify({ error: '일정 생성에 실패했습니다.' }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      console.log('일정 생성 완료:', { scheduleId: newSchedule.id, userId: currentUser.id })

      return new Response(
        JSON.stringify({ success: true, data: newSchedule }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    } else {
      // 수정: 본인 일정 확인 후 UPDATE
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

      // 본인 일정만 수정 가능
      if (schedule.created_by !== currentUser.id) {
        return new Response(
          JSON.stringify({ error: '본인이 등록한 일정만 수정할 수 있습니다.' }),
          { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      // 이미 삭제된 일정은 수정 불가
      if (schedule.deleted_at) {
        return new Response(
          JSON.stringify({ error: '삭제된 일정은 수정할 수 없습니다.' }),
          { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      // 수정 payload에서 created_by 변경 방지
      delete sanitizedPayload.created_by

      const { data: updatedSchedule, error: updateError } = await supabaseAdmin
        .from('schedules')
        .update(sanitizedPayload)
        .eq('id', scheduleId)
        .select()
        .single()

      if (updateError) {
        console.error('일정 수정 실패:', updateError)
        return new Response(
          JSON.stringify({ error: '일정 수정에 실패했습니다.' }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      console.log('일정 수정 완료:', { scheduleId, userId: currentUser.id })

      return new Response(
        JSON.stringify({ success: true, data: updatedSchedule }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('update-schedule 에러:', error)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
