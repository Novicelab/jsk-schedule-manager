import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './LoginPage.css'

// prompt=login 제거: Kakao 로그아웃 엔드포인트 도입으로 Kakao 세션이 이미 종료되어 있음
// prompt=login은 Android에서 카카오톡 앱 연동 로그인과 충돌하므로 사용하지 않음
const buildKakaoAuthUrl = () => {
  // state 파라미터: CSRF 검증용
  const state = crypto.randomUUID()
  sessionStorage.setItem('kakao_oauth_state', state)
  // scope=talk_message 제거: 알림 기능 비활성화 상태, 비즈앱 미전환 시 KOE205 에러 유발
  // encodeURIComponent 제거: 카카오 OAuth는 redirect_uri 평문 전달 표준
  const redirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI
  return `https://kauth.kakao.com/oauth/authorize?client_id=${
    import.meta.env.VITE_KAKAO_CLIENT_ID
  }&redirect_uri=${redirectUri}&response_type=code&state=${state}`
}

function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
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
