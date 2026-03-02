import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './LoginPage.css'

const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${
  import.meta.env.VITE_KAKAO_CLIENT_ID
}&redirect_uri=${
  import.meta.env.VITE_KAKAO_REDIRECT_URI
}&response_type=code&scope=talk_message`

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
    window.location.href = KAKAO_AUTH_URL
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
