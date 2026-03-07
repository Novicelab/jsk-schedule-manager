import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cleanupSession } from '../lib/sessionCleanup'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      console.log('=== 로그아웃 시작 ===')

      // 1. Supabase Auth signOut (서버 세션 무효화)
      await supabase.auth.signOut()
      console.log('✓ Supabase Auth signOut 완료')

    } catch (err) {
      console.error('로그아웃 중 에러:', err)
    } finally {
      // 2. 모든 세션 및 저장소 완전 초기화
      cleanupSession()
      console.log('✓ 세션 및 저장소 완전 정리')

      // 3. 페이지 전체 새로고침 (유일한 확실한 방법)
      // window.location.href는 메모리 상태를 유지하므로 불안정
      // window.location.reload()는 다음을 보장:
      // - Supabase JS Client 싱글턴 재생성
      // - localStorage 다시 읽음 (이미 정리됨)
      // - 메모리의 모든 상태 초기화
      // - App → PrivateRoute → session 없음 → /login 자동 이동
      console.log('=== 페이지 새로고침 중 ===')

      // 짧은 딜레이 후 새로고침 (cleanupSession 완료 보장)
      setTimeout(() => {
        window.location.reload()
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
