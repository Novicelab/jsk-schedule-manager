import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './LoginPage.css'

const buildKakaoAuthUrl = () => {
  // state 파라미터: CSRF 검증용
  const state = crypto.randomUUID()
  sessionStorage.setItem('kakao_oauth_state', state)
  const redirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI
  // prompt=login: 카카오 브라우저 세션이 남아있어도 강제로 로그인 화면 표시
  // 이 파라미터 없으면 로그아웃 후에도 카카오 자동 로그인됨
  return `https://kauth.kakao.com/oauth/authorize?client_id=${
    import.meta.env.VITE_KAKAO_CLIENT_ID
  }&redirect_uri=${redirectUri}&response_type=code&state=${state}&prompt=login`
}

function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // 세션 확인 (로그인되어 있으면 캘린더로 이동)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('세션 있음, 캘린더로 이동')
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
