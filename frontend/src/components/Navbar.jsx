import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('로그아웃 실패:', err)
    } finally {
      localStorage.removeItem('user')
      navigate('/login', { replace: true })
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">간호부 일정 관리</div>
      <div className="navbar-actions">
        {/* TODO: 설정 버튼 - 당분간 숨김 처리 */}
        {/* <button className="btn btn-settings" onClick={() => navigate('/mypage')}>
          설정
        </button> */}
        <button className="btn btn-logout" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </nav>
  )
}

export default Navbar
