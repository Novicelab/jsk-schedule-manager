import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('user')
    } catch (err) {
      console.error('로그아웃 실패:', err)
      localStorage.removeItem('user')
    }

    // Kakao 세션도 종료: logout_redirect_uri로 로그인 페이지 이동
    // 이렇게 하면 prompt=login 없이도 다음 로그인 시 Kakao 로그인 페이지가 정상 표시됨
    const kakaoClientId = import.meta.env.VITE_KAKAO_CLIENT_ID
    const logoutRedirectUri = encodeURIComponent(window.location.origin + '/login')
    window.location.href = `https://kauth.kakao.com/oauth/logout?client_id=${kakaoClientId}&logout_redirect_uri=${logoutRedirectUri}`
  }

  const handleSettings = () => {
    navigate('/mypage')
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">간호부 일정 관리</div>
      <div className="navbar-actions">
        <button className="btn btn-settings" onClick={handleSettings}>
          설정
        </button>
        <button className="btn btn-logout" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </nav>
  )
}

export default Navbar
