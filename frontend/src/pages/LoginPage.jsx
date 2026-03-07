import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './LoginPage.css'

const buildKakaoAuthUrl = () => {
  // state 파라미터: CSRF 검증용
  const state = crypto.randomUUID()
  sessionStorage.setItem('kakao_oauth_state', state)
  const redirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI
  // 주의: prompt=login은 카카오 OAuth 표준 파라미터가 아님 (제거)
  // 카카오톡 간편로그인 UI 방지는 Kakao SDK 설정이나 별도 파라미터로 처리
  return `https://kauth.kakao.com/oauth/authorize?client_id=${
    import.meta.env.VITE_KAKAO_CLIENT_ID
  }&redirect_uri=${redirectUri}&response_type=code&state=${state}`
}

function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // 로그아웃 직후는 자동 리다이렉트 방지
    // (signOut() 비동기 처리 후 getSession()이 아직 유효한 세션을 반환할 수 있는 레이스 컨디션 방지)
    const justLoggedOut = sessionStorage.getItem('_just_logged_out')
    if (justLoggedOut) {
      console.log('로그아웃 직후 자동 리다이렉트 스킵')
      sessionStorage.removeItem('_just_logged_out')
      return
    }

    // signOut() 완료 후 localStorage 정리까지의 지연을 보장하기 위해
    // 200ms 후 getSession() 호출 (100ms는 window.location.href delay, 추가 100ms는 signOut 완료 대기)
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          console.log('세션 있음, 캘린더로 이동')
          navigate('/', { replace: true })
        } else {
          console.log('세션 없음, 로그인 페이지 유지')
        }
      })
    }, 200)

    return () => clearTimeout(timer)
  }, [navigate])

  const handleKakaoLogin = () => {
    window.location.href = buildKakaoAuthUrl()
  }

  return (
    <div className="login-page">
      {/* 배경 떠다니는 원형 */}
      <div className="login-bg-circle circle-1" />
      <div className="login-bg-circle circle-2" />
      <div className="login-bg-circle circle-3" />
      <div className="login-bg-circle circle-4" />

      <div className="login-card">
        <div className="login-icon">🌸</div>
        <h1 className="login-title">간호부 일정 관리 시스템</h1>
        <p className="login-subtitle">베타서비스 중</p>
        <button className="btn-kakao" onClick={handleKakaoLogin}>
          <span className="btn-kakao-icon">💬</span>
          카카오로 시작하기
        </button>
      </div>
    </div>
  )
}

export default LoginPage
