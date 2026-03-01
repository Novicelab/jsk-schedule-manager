import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: '사용자 ID가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authorization 헤더로 요청자 검증
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin Client (Service Role)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 삭제 대상 사용자 조회 (auth_id로 요청자와 동일인 확인)
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, auth_id')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 요청자가 본인 계정만 삭제 가능
    if (targetUser.auth_id !== authUser.id) {
      return new Response(
        JSON.stringify({ error: '본인 계정만 탈퇴할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. notifications 삭제
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId)

    // 2. notification_preferences 삭제
    await supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId)

    // 3. users 테이블 삭제
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteUserError) {
      console.error('users 삭제 실패:', deleteUserError)
      return new Response(
        JSON.stringify({ error: '사용자 데이터 삭제에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Supabase Auth 계정 삭제
    if (targetUser.auth_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.auth_id)
      if (authDeleteError) {
        console.warn('Auth 계정 삭제 실패 (users 삭제는 완료):', authDeleteError)
      }
    }

    console.log('사용자 탈퇴 완료:', { userId, authId: targetUser.auth_id })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('delete-user 에러:', error)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
