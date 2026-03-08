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
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { userId, name, kakaoId, authId } = await req.json()

    if (!userId || !name) {
      return new Response(
        JSON.stringify({ error: '사용자 ID와 이름이 필요합니다.' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Authorization 헤더 검증 (토큰 필수)
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

    // 요청자 JWT 검증
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

    // Supabase Admin Client (Service Role Key 사용)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 요청자의 users 테이블 ID 조회 (auth_id 기준)
    const { data: requestingUser, error: requestingUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (requestingUserError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: '요청자 정보를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // 본인 정보만 수정 가능
    if (requestingUser.id !== userId) {
      console.error('소유권 검증 실패:', { requestingUserId: requestingUser.id, targetUserId: userId })
      return new Response(
        JSON.stringify({ error: '본인의 정보만 수정할 수 있습니다.' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    console.log('update-user-name 요청 검증 완료:', { userId, authUserId: authUser.id })

    // 사용자 존재 여부 확인
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from('users')
      .select('id, name, auth_id, kakao_id')
      .eq('id', userId)
      .single()

    if (selectError) {
      console.error('사용자 조회 실패:', {
        message: selectError.message,
        code: selectError.code,
        details: JSON.stringify(selectError)
      })
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (!existingUser) {
      console.error('사용자 데이터 없음:', { userId })
      return new Response(
        JSON.stringify({ error: '사용자 정보를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    console.log('사용자 조회 완료:', {
      userId: existingUser.id,
      authId: existingUser.auth_id,
      kakaoId: existingUser.kakao_id,
      currentName: existingUser.name
    })

    // 이름 + auth_id 업데이트 (Service Role로 RLS 정책 우회)
    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      updated_at: new Date().toISOString()
    }
    if (authId) {
      updatePayload.auth_id = authId
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('이름 업데이트 실패:', {
        message: updateError.message,
        code: updateError.code,
        details: JSON.stringify(updateError)
      })
      return new Response(
        JSON.stringify({ error: '이름 업데이트에 실패했습니다.' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (!updatedUser) {
      console.error('이름 업데이트 실패 (no data):', { userId })
      return new Response(
        JSON.stringify({ error: '사용자 정보 업데이트에 실패했습니다.' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    console.log('이름 업데이트 완료:', {
      userId: updatedUser.id,
      newName: updatedUser.name,
      updatedAt: updatedUser.updated_at
    })

    return new Response(
      JSON.stringify({
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          kakaoId: updatedUser.kakao_id,
          email: updatedUser.email
        }
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('update-user-name 에러:', error)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
