import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NameInputModal from '../components/auth/NameInputModal'
import LoadingPopup from '../components/LoadingPopup'

function CallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState(null)
  const [showNameModal, setShowNameModal] = useState(false)
  // StrictMode 이중 실행 방지
  const called = useRef(false)
  // 백버튼 핸들러 중복 실행 방지
  const isExiting = useRef(false)

  // 회원가입 필수 입력: 사용자명 입력 모달 렌더링 중 뒤로가기/이탈 시 세션 정리 후 로그인 페이지로 강제 이동
  useEffect(() => {
    if (!showNameModal) return

    const cleanupAndRedirect = async (reason) => {
      // 중복 실행 방지 (popstate 무한 루프 차단)
      if (isExiting.current) return
      isExiting.current = true

      console.warn(`회원가입 중 이탈 감지 (${reason}): 세션 정리 후 로그인 페이지로 이동`)

      // 세션 로그아웃
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {})

      // localStorage 정리
      localStorage.removeItem('user')

      // 하드 리다이렉트 (React Router navigate 대신 사용하여 popstate 재트리거 방지)
      window.location.replace('/login')
    }

    const handlePopState = (e) => {
      e.preventDefault()
      cleanupAndRedirect('백버튼')
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault()
        cleanupAndRedirect('ESC키')
      }
    }

    // 뒤로가기 시도 감지
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)

    // beforeunload: 창 닫기/탭 닫기 시도 시 경고
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = '회원가입을 완료해주세요.'
      return '회원가입을 완료해주세요.'
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [showNameModal])

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    if (!code) {
      setErrorMessage('인증 코드가 없습니다. 다시 로그인해주세요.')
      setTimeout(() => navigate('/login', { replace: true }), 2000)
      return
    }

    // CSRF 검증: state 파라미터 확인
    const returnedState = searchParams.get('state')
    const savedState = sessionStorage.getItem('kakao_oauth_state')
    if (savedState && returnedState !== savedState) {
      console.error('OAuth state mismatch:', { returnedState, savedState })
      setErrorMessage('보안 검증에 실패했습니다. 다시 로그인해주세요.')
      sessionStorage.removeItem('kakao_oauth_state')
      setTimeout(() => navigate('/login', { replace: true }), 2000)
      return
    }
    sessionStorage.removeItem('kakao_oauth_state')

    // iOS Safari bfcache 이중 실행 방지: 동일 code 재사용 차단
    const usedKey = `auth_code_used_${code}`
    if (sessionStorage.getItem(usedKey)) {
      console.warn('이미 사용된 인가 코드, 무시:', code.substring(0, 8))
      navigate('/login', { replace: true })
      return
    }
    sessionStorage.setItem(usedKey, 'true')

    const processCallback = async () => {
      try {
        console.log('=== 카카오 로그인 콜백 시작 ===')
        // 이전 사용자 정보 초기화 (멀티 단말 계정 혼동 방지)
        localStorage.removeItem('user')
        const redirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI

        // Edge Function 호출: supabase.functions.invoke() 사용
        // fetch 직접 호출 시 헤더 값에 개행문자 등이 포함되면
        // "Failed to execute 'fetch' on 'Window': Invalid value" 에러 발생
        console.log('Edge Function 호출 중...')
        const { data, error: invokeError } = await supabase.functions.invoke('kakao-auth', {
          body: { code, redirectUri },
        })

        if (invokeError) {
          // Supabase SDK는 non-2xx 응답 시 data=null, invokeError.context에 Response 객체를 저장
          let detail = data?.error || data?.debug || invokeError.message
          // FunctionsHttpError인 경우 response body에서 실제 에러 정보 추출
          if (invokeError.context && typeof invokeError.context.json === 'function') {
            try {
              const errorBody = await invokeError.context.json()
              detail = errorBody?.error || errorBody?.debug?.reason || errorBody?.debug?.message || detail
              console.error('Edge Function 에러 상세 (body):', errorBody)
            } catch (parseErr) {
              console.warn('Edge Function 에러 body 파싱 실패:', parseErr)
            }
          }
          console.error('Edge Function 에러:', { invokeError, data, detail })
          throw new Error(typeof detail === 'string' ? detail : invokeError.message || 'Edge Function 호출 실패')
        }

        if (!data || data.error) {
          console.error('Edge Function 응답 에러:', data)
          throw new Error(data?.error || 'Edge Function 응답 오류')
        }

        console.log('Edge Function 응답 수신:', { data })

        const { session, user, isNewUser } = data

        if (!session) {
          throw new Error('세션 데이터를 받지 못했습니다. 다시 로그인해주세요.')
        }

        console.log('카카오 로그인 - 사용자 정보 확인:', {
          userId: user?.id,
          userName: user?.name,
          isNewUser,
          fullUser: user
        })

        // Supabase 세션 설정
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })

        // 세션 완전 로드 대기 (최대 10초)
        let sessionLoaded = false
        let attempts = 0
        const maxAttempts = 100 // 10초 (100ms * 100)

        while (!sessionLoaded && attempts < maxAttempts) {
          const { data: currentSession } = await supabase.auth.getSession()
          if (currentSession.session?.user?.id && currentSession.session?.access_token) {
            console.log('세션 로드 완료:', {
              authUserId: currentSession.session.user.id,
              hasAccessToken: !!currentSession.session.access_token,
              attempts: attempts + 1
            })
            sessionLoaded = true
          } else {
            console.log('세션 대기 중...', { attempt: attempts + 1, maxAttempts })
            await new Promise(resolve => setTimeout(resolve, 100))
            attempts++
          }
        }

        if (!sessionLoaded) {
          console.warn('세션 로드 타임아웃 (10초), 계속 진행')
        }

        // user 정보를 localStorage에 저장 (표시용)
        localStorage.setItem('user', JSON.stringify(user))
        console.log('localStorage에 사용자 정보 저장 완료:', user)

        if (isNewUser) {
          setShowNameModal(true)
        } else {
          navigate('/', { replace: true })
        }
        console.log('=== 카카오 로그인 완료 ===')
      } catch (err) {
        console.error('카카오 로그인 처리 실패:', err.message)
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
    <LoadingPopup isOpen={true} message="로그인 처리 중입니다..." />
  )
}

export default CallbackPage
