import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NameInputModal from '../components/auth/NameInputModal'

function CallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState(null)
  const [showNameModal, setShowNameModal] = useState(false)
  // StrictMode 이중 실행 방지
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    if (!code) {
      setErrorMessage('인증 코드가 없습니다. 다시 로그인해주세요.')
      setTimeout(() => navigate('/login', { replace: true }), 2000)
      return
    }

    const processCallback = async () => {
      try {
        console.log('=== 카카오 로그인 콜백 시작 ===')
        console.log('0. 환경변수 확인:')
        console.log('   - VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
        console.log('   - VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...')
        console.log('1. URL 파라미터 확인:')
        console.log('   - code:', code)
        console.log('   - redirectUri:', import.meta.env.VITE_KAKAO_REDIRECT_URI)

        // Edge Function 호출: 카카오 OAuth 처리 (직접 fetch 사용)
        console.log('2. Edge Function 호출 중...')
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kakao-auth`
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const authHeader = `Bearer ${anonKey}`
        const bodyData = {
          code,
          redirectUri: import.meta.env.VITE_KAKAO_REDIRECT_URI,
        }

        console.log('   - URL:', functionUrl)
        console.log('   - Authorization 헤더:', authHeader.substring(0, 30) + '...')
        console.log('   - Body:', bodyData)
        console.log('   - anonKey 존재:', !!anonKey)
        console.log('   - anonKey 길이:', anonKey?.length)

        let response
        let lastError
        const maxRetries = 5

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`   - fetch 호출 시작... (시도 ${attempt}/${maxRetries})`)

            response = await fetch(functionUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: {
                'Content-Type': 'application/json',
              },
            }).then(async (res) => {
              // no-cors 모드에서는 response body를 직접 읽을 수 없으므로
              // 다시 cors 모드로 시도
              if (!res.ok || res.type === 'opaque') {
                console.log('   - no-cors 실패, cors 모드로 재시도...')
                return fetch(functionUrl, {
                  method: 'POST',
                  mode: 'cors',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                  },
                  body: JSON.stringify(bodyData),
                })
              }
              return res
            })

            console.log(`   - fetch 호출 완료 (시도 ${attempt})`)
            break // 성공하면 루프 탈출
          } catch (fetchErr) {
            lastError = fetchErr
            console.error(`   - fetch 실패 (시도 ${attempt}/${maxRetries}):`, fetchErr.message)

            if (attempt < maxRetries) {
              const delay = attempt * 1000 // 1초, 2초, 3초, 4초, 5초
              console.log(`   - ${delay}ms 후 재시도...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
        }

        if (!response) {
          throw lastError || new Error('모든 재시도 실패')
        }

        console.log('3. Edge Function 응답:')
        console.log('   - 상태 코드:', response.status)
        console.log('   - 상태 텍스트:', response.statusText)

        let data
        try {
          data = await response.json()
        } catch (e) {
          console.error('   - JSON 파싱 실패:', e)
          data = null
        }

        console.log('   - 응답 데이터:', data)

        if (!response.ok) {
          throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        console.log('4. 응답 데이터 구조 확인:')
        console.log('   - session:', data?.session)
        console.log('   - user:', data?.user)
        console.log('   - isNewUser:', data?.isNewUser)

        const { session, user, isNewUser } = data

        // Supabase 세션 설정
        if (session) {
          console.log('5. Supabase 세션 설정 중...')
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
          console.log('   - 세션 설정 완료')
        } else {
          console.warn('   - 세션 데이터 없음!')
        }

        // user 정보를 localStorage에 저장 (표시용)
        console.log('6. localStorage에 사용자 정보 저장...')
        localStorage.setItem('user', JSON.stringify(user))
        console.log('   - 저장 완료')

        console.log('7. isNewUser 확인:', isNewUser, '타입:', typeof isNewUser)

        if (isNewUser) {
          console.log('8. 신규 사용자 → NameInputModal 표시')
          setShowNameModal(true)
        } else {
          console.log('8. 기존 사용자 → 메인 페이지로 이동')
          navigate('/', { replace: true })
        }
        console.log('=== 카카오 로그인 완료 ===')
      } catch (err) {
        console.error('❌ 카카오 로그인 처리 실패:')
        console.error('   - 에러 타입:', err.constructor.name)
        console.error('   - 에러 메시지:', err.message)
        console.error('   - 전체 에러:', err)
        const message = err.message || '로그인 처리 중 오류가 발생했습니다.'
        setErrorMessage(message)
        setTimeout(() => navigate('/login', { replace: true }), 2000)
      }
    }

    processCallback()
  }, [navigate, searchParams])

  if (errorMessage) {
    return (
      <div className="callback-page">
        <div className="callback-card">
          <p className="error-text">{errorMessage}</p>
          <p className="callback-sub">잠시 후 로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    )
  }

  if (showNameModal) {
    return (
      <NameInputModal
        onComplete={() => navigate('/', { replace: true })}
      />
    )
  }

  return (
    <div className="callback-page">
      <div className="callback-card">
        <p className="callback-loading">로그인 처리 중입니다...</p>
      </div>
    </div>
  )
}

export default CallbackPage
