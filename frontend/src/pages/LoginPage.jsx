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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
        // 세션은 있지만 localStorage에 유효한 사용자 데이터가 없는 경우
        // → stale 세션 정리 (CalendarPage와의 무한 리다이렉트 루프 방지)
        if (!storedUser.id || !storedUser.name || storedUser.name === '__PENDING__') {
          supabase.auth.signOut().catch(() => {})
          localStorage.removeItem('user')
          return
        }
        navigate('/', { replace: true })
      }
    })
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
