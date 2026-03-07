import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cleanupSession } from '../lib/sessionCleanup'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      console.log('=== 로그아웃 시작 ===')
      await supabase.auth.signOut()
      console.log('Supabase Auth signOut 완료')
    } catch (err) {
      console.error('로그아웃 실패:', err)
    } finally {
      // 모든 세션 및 저장소 완전 초기화
      cleanupSession()
      console.log('=== 로그아웃 완료, /login으로 이동 ===')
      navigate('/login', { replace: true })
    }
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
