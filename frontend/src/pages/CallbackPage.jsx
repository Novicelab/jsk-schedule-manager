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
        // Edge Function 호출: 카카오 OAuth 처리
        const { data, error } = await supabase.functions.invoke('kakao-auth', {
          body: {
            code,
            redirectUri: import.meta.env.VITE_KAKAO_REDIRECT_URI,
          },
        })

        if (error) throw error

        console.log('카카오 로그인 응답:', data)

        const { session, user, isNewUser } = data

        // Supabase 세션 설정
        if (session) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
        }

        // user 정보를 localStorage에 저장 (표시용)
        localStorage.setItem('user', JSON.stringify(user))

        console.log('isNewUser 값:', isNewUser, '타입:', typeof isNewUser)

        if (isNewUser) {
          console.log('신규 사용자 감지 → NameInputModal 표시')
          setShowNameModal(true)
        } else {
          console.log('기존 사용자 → 메인 페이지로 이동')
          navigate('/', { replace: true })
        }
      } catch (err) {
        console.error('카카오 로그인 처리 실패:', err)
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
