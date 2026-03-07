import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cleanupSession } from '../lib/sessionCleanup'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      console.log('=== 로그아웃 시작 ===')

      // 1. Supabase Auth signOut
      await supabase.auth.signOut()
      console.log('✓ Supabase Auth signOut 완료')

    } catch (err) {
      console.error('로그아웃 중 에러:', err)
    } finally {
      // 3. 모든 세션 및 저장소 완전 초기화
      cleanupSession()

      // 4. 페이지 새로고침으로 메모리 초기화 (추가 안전성)
      // localStorage 정리 후 페이지를 새로고침하면
      // React 컴포넌트가 다시 마운트될 때 인증 상태를 새로 인식
      console.log('=== 로그아웃 완료, 페이지 초기화 중 ===')

      // 짧은 딜레이 후 로그인 페이지로 이동 (localStorage 정리 보장)
      setTimeout(() => {
        window.location.href = '/login'
      }, 100)
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
