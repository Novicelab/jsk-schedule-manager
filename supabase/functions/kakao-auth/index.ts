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

    // 1. 카카오 토큰 교환 (최대 2회 재시도)
    let tokenResponse: Response | null = null
    let tokenData: Record<string, unknown> | null = null
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KAKAO_CLIENT_ID,
      client_secret: KAKAO_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
    })

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams,
        })

        if (tokenResponse.ok) {
          tokenData = await tokenResponse.json()
          console.log(`카카오 토큰 교환 성공 (시도 ${attempt})`)
          break
        }

        const errorText = await tokenResponse.text()
        console.error(`카카오 토큰 교환 실패 (시도 ${attempt}/${2}):`, {
          status: tokenResponse.status,
          body: errorText
        })

        if (attempt < 2) {
          // 재시도 전 500ms 대기
          await new Promise(resolve => setTimeout(resolve, 500))
        } else {
          return new Response(
            JSON.stringify({
              error: '카카오 인증에 실패했습니다.',
              debug: { status: tokenResponse.status, body: errorText }
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (fetchError) {
        console.error(`카카오 토큰 교환 네트워크 오류 (시도 ${attempt}/${2}):`, fetchError)
        if (attempt >= 2) {
          return new Response(
            JSON.stringify({ error: '카카오 서버 연결에 실패했습니다.' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: '카카오 토큰 데이터를 받지 못했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // authorization_code는 1회용: 이미 사용된 코드는 KOE320 에러 반환
    if (tokenData.error) {
      console.error('카카오 토큰 에러 응답:', tokenData)
      return new Response(
        JSON.stringify({
          error: '카카오 인가 코드가 유효하지 않습니다. 다시 로그인해주세요.',
          debug: { kakaoError: tokenData.error, description: tokenData.error_description }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const kakaoAccessToken = tokenData.access_token as string
    const kakaoRefreshToken = (tokenData.refresh_token as string) || null
    const expiresIn = (tokenData.expires_in as number) || 21600 // 기본 6시간
    const kakaoTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // 2. 카카오 사용자 정보 조회
    const userInfoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    })

    if (!userInfoResponse.ok) {
      const userInfoError = await userInfoResponse.text()
      console.error('카카오 사용자 정보 조회 실패:', {
        status: userInfoResponse.status,
        body: userInfoError
      })
      return new Response(
        JSON.stringify({
          error: '카카오 사용자 정보 조회에 실패했습니다.',
          debug: { status: userInfoResponse.status }
        }),
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

    // Supabase Auth용 이메일/비밀번호 (결정적, 강화된 버전)
    const authEmail = `kakao_${kakaoId}@kakao.local`
    const SERVICE_KEY_SUFFIX = SUPABASE_SERVICE_ROLE_KEY.slice(-12)
    const newAuthPassword = `kakao_${kakaoId}_${KAKAO_CLIENT_SECRET}_${SERVICE_KEY_SUFFIX}`
    // 기존 사용자 호환성: 마이그레이션 시 사용
    const oldAuthPassword = `kakao_${kakaoId}_${KAKAO_CLIENT_SECRET.substring(0, 8)}`

    if (!existingUser) {
      // 5a. 신규 사용자: Supabase Auth 계정 생성
      isNewUser = true

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: newAuthPassword,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, nickname },
      })

      if (authError) {
        // 422 Conflict: 이메일이 이미 등록됨 (Auth만 있고 users는 없는 경우)
        if (authError.status === 422) {
          console.warn('Auth 사용자 중복 감지, users 테이블 복구 시도:', {
            email: authEmail,
            kakaoId: kakaoId
          })

          // Auth 사용자는 이미 있으므로, users 테이블에 복구 로직
          // (isNewUser는 이후 user.name 값으로 결정됨)

          // 이 시점에서는 Auth 사용자가 이미 생성되었음
          // 따라서 auth_id는 AuthError에서 추출 가능 (이메일로 조회 후 가져옴)
          // 하지만 간단하게, Supabase Auth 사용자 이메일로 조회하여 ID 얻기
          const { data: existingAuthData } = await supabaseAdmin.auth.admin.getUserByEmail(authEmail)
          const authId = existingAuthData?.user?.id || null
          console.log('422 복구: Auth 사용자 조회 결과:', { authId, hasData: !!existingAuthData })

          // 기존 Auth 사용자의 비밀번호를 현재 newAuthPassword로 갱신
          // (이전 실패 시도에서 다른 비밀번호로 생성되었을 수 있음)
          if (authId) {
            try {
              await supabaseAdmin.auth.admin.updateUserById(authId, {
                password: newAuthPassword,
              })
              console.log('422 복구: Auth 비밀번호 갱신 완료:', authId)
            } catch (pwdError) {
              console.warn('422 복구: Auth 비밀번호 갱신 실패 (로그인 진행):', pwdError)
            }
          }

          const { data: updatedUser, error: upsertError } = await supabaseAdmin
            .from('users')
            .upsert({
              kakao_id: kakaoId,
              name: '__PENDING__',
              email: email,
              profile_image_url: profileImageUrl,
              kakao_access_token: kakaoAccessToken,
              kakao_refresh_token: kakaoRefreshToken,
              kakao_token_expires_at: kakaoTokenExpiresAt,
              auth_id: authId,
              role: 'USER',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'kakao_id' })
            .select()
            .single()

          if (upsertError) {
            console.error('users 테이블 422 upsert 실패:', {
              message: upsertError.message,
              code: upsertError.code,
              details: JSON.stringify(upsertError)
            })
            return new Response(
              JSON.stringify({
                error: '사용자 정보 저장에 실패했습니다.',
                details: upsertError.message,
                code: upsertError.code
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          if (updatedUser) {
            user = updatedUser
            console.log('users 테이블 복구 완료:', user.id)
          } else {
            console.error('users 테이블 upsert 실패 (no data)')
            return new Response(
              JSON.stringify({ error: '사용자 정보 저장에 실패했습니다.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          // 다른 Auth 에러
          console.error('Supabase Auth 사용자 생성 실패:', {
            message: authError.message,
            status: authError.status,
            details: JSON.stringify(authError)
          })
          return new Response(
            JSON.stringify({
              error: '사용자 생성에 실패했습니다.',
              details: authError.message,
              debug: {
                email: authEmail,
                errorStatus: authError.status
              }
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Auth 생성 성공: users 테이블에 추가
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            kakao_id: kakaoId,
            name: '__PENDING__',
            email: email,
            profile_image_url: profileImageUrl,
            kakao_access_token: kakaoAccessToken,
            kakao_refresh_token: kakaoRefreshToken,
            kakao_token_expires_at: kakaoTokenExpiresAt,
            auth_id: authData!.user.id,
            role: 'USER',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          console.error('사용자 DB 추가 실패:', insertError)
          // Auth는 이미 생성되었으므로, users 테이블에 upsert로 복구 시도
          console.warn('users 테이블 upsert 시도 중...')
          const { data: upsertedUser, error: upsertError } = await supabaseAdmin
            .from('users')
            .upsert({
              kakao_id: kakaoId,
              name: '__PENDING__',
              email: email,
              profile_image_url: profileImageUrl,
              kakao_access_token: kakaoAccessToken,
              kakao_refresh_token: kakaoRefreshToken,
              kakao_token_expires_at: kakaoTokenExpiresAt,
              auth_id: authData!.user.id,
              role: 'USER',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'kakao_id' })
            .select()
            .single()

          if (upsertError) {
            console.error('users 테이블 INSERT 실패 후 upsert 재시도 실패:', {
              message: upsertError.message,
              code: upsertError.code,
              details: JSON.stringify(upsertError)
            })
            return new Response(
              JSON.stringify({
                error: '사용자 정보 저장에 실패했습니다.',
                details: upsertError.message,
                code: upsertError.code
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          if (!upsertedUser) {
            return new Response(
              JSON.stringify({ error: '사용자 정보 저장에 실패했습니다.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          user = upsertedUser
        } else {
          user = newUser
        }

        // 알림 설정 기본값 생성 (실패해도 로그인 진행)
        const defaultPreferences = [
          { user_id: user.id, schedule_type: 'VACATION', action_type: 'CREATED', enabled: true },
          { user_id: user.id, schedule_type: 'VACATION', action_type: 'UPDATED', enabled: true },
          { user_id: user.id, schedule_type: 'VACATION', action_type: 'DELETED', enabled: true },
          { user_id: user.id, schedule_type: 'WORK', action_type: 'CREATED', enabled: true },
          { user_id: user.id, schedule_type: 'WORK', action_type: 'UPDATED', enabled: true },
          { user_id: user.id, schedule_type: 'WORK', action_type: 'DELETED', enabled: true },
        ]

        try {
          await supabaseAdmin.from('notification_preferences').insert(defaultPreferences)
          console.log('알림 설정 기본값 생성 완료:', user.id)
        } catch (prefError) {
          console.warn('알림 설정 생성 실패 (로그인은 진행):', prefError)
          // 알림 설정 없이도 로그인 진행 가능
        }

        // 신규 사용자 생성 완료 로깅
        console.log('신규 사용자 생성 완료 - 상세 정보:', {
          userId: user.id,
          authId: user.auth_id,
          kakaoId: user.kakao_id,
          userName: user.name,
          userEmail: user.email,
          userIdType: typeof user.id,
          authIdType: typeof user.auth_id
        })
      }
    } else {
      // 5b. 기존 사용자: 카카오 토큰 업데이트
      const { data: updatedUser } = await supabaseAdmin
        .from('users')
        .update({
          kakao_access_token: kakaoAccessToken,
          kakao_refresh_token: kakaoRefreshToken,
          kakao_token_expires_at: kakaoTokenExpiresAt,
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
          password: newAuthPassword,
          email_confirm: true,
          user_metadata: { kakao_id: kakaoId, nickname: user.name },
        })

        if (!authError && authData.user) {
          await supabaseAdmin
            .from('users')
            .update({ auth_id: authData.user.id })
            .eq('id', user.id)
          user.auth_id = authData.user.id
        } else if (authError?.status === 422) {
          // 422: 이메일이 이미 등록됨 (이전 시도의 잔존 사용자)
          console.warn('기존 사용자 Auth 중복 감지, 비밀번호 갱신 및 매핑:', {
            userId: user.id,
            email: authEmail
          })
          // Auth 사용자 조회 후 비밀번호 갱신 + auth_id 매핑
          const { data: existingAuthData2 } = await supabaseAdmin.auth.admin.getUserByEmail(authEmail)
          const existingAuthUserId = existingAuthData2?.user?.id
          if (existingAuthUserId) {
            try {
              await supabaseAdmin.auth.admin.updateUserById(existingAuthUserId, {
                password: newAuthPassword,
              })
              await supabaseAdmin
                .from('users')
                .update({ auth_id: existingAuthUserId })
                .eq('id', user.id)
              user.auth_id = existingAuthUserId
              console.log('기존 사용자 Auth 복구 완료:', existingAuthUserId)
            } catch (recoveryError) {
              console.warn('기존 사용자 Auth 복구 실패:', recoveryError)
            }
          }
        }
      }
    }

    // 6. Supabase Auth 로그인 (세션 발급) + 마이그레이션
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)

    // 새 비밀번호로 먼저 시도
    let sessionData = await supabaseClient.auth.signInWithPassword({
      email: authEmail,
      password: newAuthPassword,
    })

    // 실패 시 기존 비밀번호로 재시도 (마이그레이션 - 기존 사용자만)
    if (sessionData.error && !isNewUser) {
      console.warn('새 비밀번호 로그인 실패, 기존 비밀번호로 재시도:', sessionData.error)
      sessionData = await supabaseClient.auth.signInWithPassword({
        email: authEmail,
        password: oldAuthPassword,
      })

      // 기존 비밀번호로 성공했다면 새 비밀번호로 자동 업그레이드
      if (!sessionData.error && sessionData.data.user) {
        console.log('기존 사용자 자동 마이그레이션 시작:', sessionData.data.user.id)
        try {
          await supabaseAdmin.auth.admin.updateUserById(sessionData.data.user.id, {
            password: newAuthPassword,
          })
          console.log('기존 사용자 비밀번호 업그레이드 완료')
        } catch (migrationError) {
          console.warn('비밀번호 업그레이드 실패 (로그인은 진행):', migrationError)
        }
      }
    }

    // 신규 사용자(422 복구 경로): 비밀번호 불일치 시 강제 갱신 후 재시도
    if (sessionData.error && isNewUser) {
      console.warn('신규 사용자 로그인 실패, Auth 비밀번호 강제 갱신 후 재시도:', {
        error: sessionData.error.message,
        authEmail
      })
      try {
        const { data: authLookup } = await supabaseAdmin.auth.admin.getUserByEmail(authEmail)
        const lookupAuthId = authLookup?.user?.id
        if (lookupAuthId) {
          await supabaseAdmin.auth.admin.updateUserById(lookupAuthId, {
            password: newAuthPassword,
          })
          console.log('신규 사용자 Auth 비밀번호 강제 갱신 완료:', lookupAuthId)
          sessionData = await supabaseClient.auth.signInWithPassword({
            email: authEmail,
            password: newAuthPassword,
          })
          if (!sessionData.error) {
            console.log('신규 사용자 비밀번호 갱신 후 로그인 성공')
          }
        }
      } catch (retryError) {
        console.error('신규 사용자 로그인 재시도 실패:', retryError)
      }
    }

    if (sessionData.error) {
      console.error('Supabase 로그인 최종 실패:', {
        message: sessionData.error.message,
        status: sessionData.error.status,
        authEmail,
        isNewUser,
        userIdInDb: user?.id
      })
      return new Response(
        JSON.stringify({
          error: '로그인 처리에 실패했습니다.',
          debug: {
            reason: sessionData.error.message,
            isNewUser,
            hasUserInDb: !!user
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. auth_id 동기화: 로그인 성공 시 항상 Supabase Auth UUID로 업데이트
    // (회원가입 과정 실패나 422 충돌로 auth_id가 비어있을 수 있음)
    const supabaseAuthUserId = sessionData.data.user?.id
    if (supabaseAuthUserId && user.auth_id !== supabaseAuthUserId) {
      console.log('auth_id 동기화:', { userId: user.id, oldAuthId: user.auth_id, newAuthId: supabaseAuthUserId })
      await supabaseAdmin
        .from('users')
        .update({ auth_id: supabaseAuthUserId })
        .eq('id', user.id)
      user.auth_id = supabaseAuthUserId
    }

    // 8. 응답 반환
    // isNewUser는 user.name 상태로 결정 (name이 '__PENDING__'이면 신규 사용자)
    const finalIsNewUser = user.name === '__PENDING__'

    return new Response(
      JSON.stringify({
        session: sessionData.data.session,
        user: {
          id: user.id,
          kakaoId: user.kakao_id,
          name: user.name,
          email: user.email,
          profileImageUrl: user.profile_image_url,
        },
        isNewUser: finalIsNewUser,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('kakao-auth 에러:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({
        error: '서버 오류가 발생했습니다.',
        debug: { message: errorMessage }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
