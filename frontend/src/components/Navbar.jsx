import { NavLink, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken })
      }
    } catch (err) {
      console.error('로그아웃 API 호출 실패:', err)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      navigate('/login', { replace: true })
    }
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
      <button className="btn btn-logout" onClick={handleLogout}>
        로그아웃
      </button>
    </nav>
  )
}

export default Navbar
