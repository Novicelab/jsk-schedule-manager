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
    const { code, redirectUri } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ error: '인가 코드가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 환경변수
    const KAKAO_CLIENT_ID = Deno.env.get('KAKAO_CLIENT_ID')!
    const KAKAO_CLIENT_SECRET = Deno.env.get('KAKAO_CLIENT_SECRET')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. 카카오 토큰 교환
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID,
        client_secret: KAKAO_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('카카오 토큰 교환 실패:', errorData)
      return new Response(
        JSON.stringify({ error: '카카오 인증에 실패했습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenResponse.json()
    const kakaoAccessToken = tokenData.access_token

    // 2. 카카오 사용자 정보 조회
    const userInfoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    })

    if (!userInfoResponse.ok) {
      return new Response(
        JSON.stringify({ error: '카카오 사용자 정보 조회에 실패했습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const kakaoUser = await userInfoResponse.json()
    const kakaoId = kakaoUser.id
    const nickname = kakaoUser.properties?.nickname || `카카오유저_${kakaoId}`
    const email = kakaoUser.kakao_account?.email || null
    const profileImageUrl = kakaoUser.properties?.profile_image || null

    // 3. Supabase Admin Client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 4. 기존 사용자 확인
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single()

    let user
    let isNewUser = false
    let supabaseSession

    // Supabase Auth용 이메일/비밀번호 (결정적)
    const authEmail = `kakao_${kakaoId}@kakao.local`
    const authPassword = `kakao_${kakaoId}_${KAKAO_CLIENT_SECRET.substring(0, 8)}`

    if (!existingUser) {
      // 5a. 신규 사용자: Supabase Auth 계정 생성
      isNewUser = true

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: authPassword,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, nickname },
      })

      if (authError) {
        console.error('Supabase Auth 사용자 생성 실패:', authError)
        return new Response(
          JSON.stringify({ error: '사용자 생성에 실패했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // public.users 테이블에 사용자 추가
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          kakao_id: kakaoId,
          name: '__PENDING__',
          email: email,
          profile_image_url: profileImageUrl,
          kakao_access_token: kakaoAccessToken,
          auth_id: authData.user.id,
          role: 'USER',
        })
        .select()
        .single()

      if (insertError) {
        console.error('사용자 DB 추가 실패:', insertError)
        return new Response(
          JSON.stringify({ error: '사용자 정보 저장에 실패했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      user = newUser

      // 알림 설정 기본값 생성
      const defaultPreferences = [
        { user_id: user.id, schedule_type: 'VACATION', action_type: 'CREATED', enabled: true },
        { user_id: user.id, schedule_type: 'VACATION', action_type: 'UPDATED', enabled: true },
        { user_id: user.id, schedule_type: 'VACATION', action_type: 'DELETED', enabled: true },
        { user_id: user.id, schedule_type: 'WORK', action_type: 'CREATED', enabled: true },
        { user_id: user.id, schedule_type: 'WORK', action_type: 'UPDATED', enabled: true },
        { user_id: user.id, schedule_type: 'WORK', action_type: 'DELETED', enabled: true },
      ]
      await supabaseAdmin.from('notification_preferences').insert(defaultPreferences)
    } else {
      // 5b. 기존 사용자: 카카오 토큰 업데이트
      const { data: updatedUser } = await supabaseAdmin
        .from('users')
        .update({
          kakao_access_token: kakaoAccessToken,
          profile_image_url: profileImageUrl,
        })
        .eq('kakao_id', kakaoId)
        .select()
        .single()

      user = updatedUser || existingUser

      // auth_id가 없는 기존 사용자에 대해 Supabase Auth 연동
      if (!user.auth_id) {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password: authPassword,
          email_confirm: true,
          user_metadata: { kakao_id: kakaoId, nickname: user.name },
        })

        if (!authError && authData.user) {
          await supabaseAdmin
            .from('users')
            .update({ auth_id: authData.user.id })
            .eq('id', user.id)
          user.auth_id = authData.user.id
        }
      }
    }

    // 6. Supabase Auth 로그인 (세션 발급)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })

    // 직접 세션 생성을 위해 signInWithPassword 사용
    // (Admin API의 generateLink 대신 실제 비밀번호 로그인)
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })

    if (sessionError) {
      console.error('Supabase 로그인 실패:', sessionError)
      return new Response(
        JSON.stringify({ error: '로그인 처리에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. 응답 반환
    return new Response(
      JSON.stringify({
        session: sessionData.session,
        user: {
          id: user.id,
          kakaoId: user.kakao_id,
          name: user.name,
          email: user.email,
          profileImageUrl: user.profile_image_url,
        },
        isNewUser,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('kakao-auth 에러:', error)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
