import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Navbar() {
  const navigate = useNavigate()

  // localStorage에서 user 정보 읽기
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const displayInfo = user.name ? `${user.name} / ${user.email || ''}` : ''

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

  const handleSettings = () => {
    navigate('/mypage')
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">JSK 일정 관리</div>
      <ul className="navbar-menu">
        <li>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            캘린더
          </NavLink>
        </li>
      </ul>
      <div className="navbar-center">
        {displayInfo && <span className="navbar-user-info">{displayInfo}</span>}
      </div>
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
