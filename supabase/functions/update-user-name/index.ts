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
    const { userId, name, kakaoId } = await req.json()

    // Authorization 헤더 검증
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    console.log('update-user-name 요청 시작:', {
      userId,
      name,
      kakaoId,
      authHeader: {
        hasHeader: !!authHeader,
        hasToken: !!token,
        headerValue: authHeader ? '있음' : '없음'
      }
    })

    if (!userId || !name) {
      return new Response(
        JSON.stringify({ error: '사용자 ID와 이름이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Supabase Admin Client (Service Role Key 사용)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

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
        JSON.stringify({
          error: '사용자를 찾을 수 없습니다.',
          details: selectError.message,
          code: selectError.code
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!existingUser) {
      console.error('사용자 데이터 없음:', { userId })
      return new Response(
        JSON.stringify({ error: '사용자 정보를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('사용자 조회 완료:', {
      userId: existingUser.id,
      authId: existingUser.auth_id,
      kakaoId: existingUser.kakao_id,
      currentName: existingUser.name
    })

    // 이름 업데이트 (Service Role로 RLS 정책 우회)
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString()
      })
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
        JSON.stringify({
          error: '이름 업데이트에 실패했습니다.',
          details: updateError.message,
          code: updateError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!updatedUser) {
      console.error('이름 업데이트 실패 (no data):', { userId })
      return new Response(
        JSON.stringify({ error: '사용자 정보 업데이트에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('update-user-name 에러:', error)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
