import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${
  import.meta.env.VITE_KAKAO_CLIENT_ID
}&redirect_uri=${
  import.meta.env.VITE_KAKAO_REDIRECT_URI
}&response_type=code&scope=talk_message`

function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // 이미 로그인된 상태면 메인으로 이동
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
      <div className="login-card">
        <h1 className="login-title">JSK 일정 관리</h1>
        <p className="login-subtitle">팀 중심의 스마트한 일정 관리 서비스</p>
        <button className="btn-kakao" onClick={handleKakaoLogin}>
          카카오로 시작하기
        </button>
      </div>
    </div>
  )
}

export default LoginPage
