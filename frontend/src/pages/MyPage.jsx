import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cleanupSession } from '../lib/sessionCleanup'
import Navbar from '../components/Navbar'
import LoadingPopup from '../components/LoadingPopup'

function MyPage() {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleBack = () => {
    navigate(-1)
  }

  const handleWithdraw = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      if (!currentUser.id) throw new Error('사용자 정보를 찾을 수 없습니다.')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser.id }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || '탈퇴 처리에 실패했습니다.')
      }

      try {
        await supabase.auth.signOut()
      } catch (logoutErr) {
        console.warn('탈퇴 후 로그아웃 실패 (계속 진행):', logoutErr)
        // signOut 실패해도 계속 진행 (delete-user는 성공했으므로 세션은 무효)
      }

      // 모든 세션 및 저장소 완전 초기화
      cleanupSession()

      // 페이지 전체 새로고침 (메모리 상태 완전 초기화)
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (err) {
      console.error('탈퇴 실패:', err)
      setDeleteError(err.message || '탈퇴 처리 중 오류가 발생했습니다.')
      setShowConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page-layout">
      <LoadingPopup isOpen={deleting} message="탈퇴 처리 중..." />
      <Navbar />
      <main className="mypage-main">
        <div className="mypage-container">
          <div className="mypage-header">
            <button className="btn btn-back" onClick={handleBack}>
              &larr; 뒤로가기
            </button>
            <h2 className="mypage-title">마이페이지</h2>
          </div>

          <div className="mypage-withdraw-section">
            {deleteError && (
              <div className="error-banner">{deleteError}</div>
            )}
            <button
              className={`btn-withdraw ${showConfirm ? 'btn-withdraw-confirm' : ''}`}
              onClick={handleWithdraw}
              disabled={deleting}
            >
              {showConfirm ? '정말 탈퇴하시겠습니까? (다시 클릭)' : '탈퇴하기'}
            </button>
            {showConfirm && (
              <button
                className="btn-withdraw-cancel"
                onClick={() => setShowConfirm(false)}
              >
                취소
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default MyPage
