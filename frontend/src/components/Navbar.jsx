import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Navbar() {
  const navigate = useNavigate()

  // localStorage에서 user 정보 읽기 및 실시간 동기화
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const displayInfo = user.name ? `${user.name} / ${user.email || ''}` : ''

  // storage 변경 감지하여 user 업데이트
  useEffect(() => {
    // 1. 다른 탭에서의 localStorage 변경 감지 (기존)
    const handleStorage = () => {
      console.log('Storage 이벤트 감지 (다른 탭)')
      setUser(JSON.parse(localStorage.getItem('user') || '{}'))
    }
    window.addEventListener('storage', handleStorage)

    // 2. 같은 탭 내 userUpdated CustomEvent 감지 (신규)
    const handleUserUpdated = (event) => {
      console.log('CustomEvent 감지 (같은 탭):', event.detail)
      setUser(event.detail.user)
    }
    window.addEventListener('userUpdated', handleUserUpdated)

    // 클린업
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('userUpdated', handleUserUpdated)
    }
  }, [])

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
