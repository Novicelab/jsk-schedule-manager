import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import LoadingPopup from '../components/LoadingPopup'

function MyPage() {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState(null)
  const [createdAt, setCreatedAt] = useState(null)
  const [loadingUserInfo, setLoadingUserInfo] = useState(true)
  const [userInfoError, setUserInfoError] = useState(null)

  // Load user information on mount
  useEffect(() => {
    const loadUserInfo = async () => {
      setLoadingUserInfo(true)
      try {
        // Get user from localStorage
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
        if (!storedUser.id) {
          navigate('/login', { replace: true })
          return
        }
        setUser(storedUser)

        // Query name, email, and created_at from Supabase users table
        const { data, error } = await supabase
          .from('users')
          .select('name, email, created_at')
          .eq('id', storedUser.id)
          .single()

        if (error) {
          console.error('Failed to fetch user info:', error)
          setUserInfoError('사용자 정보를 불러올 수 없습니다.')
        } else if (data) {
          // Update user name from DB
          setUser(prev => ({ ...prev, name: data.name }))
          setEmail(data.email)
          setCreatedAt(data.created_at)
        }
      } catch (err) {
        console.error('Error loading user info:', err)
        setUserInfoError('사용자 정보 로드 중 오류가 발생했습니다.')
      } finally {
        setLoadingUserInfo(false)
      }
    }

    loadUserInfo()
  }, [navigate])

  const handleBack = () => {
    navigate(-1)
  }

  // Format date to "YYYY년 MM월 DD일"
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`
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

      const { data, error: invokeError } = await supabase.functions.invoke('delete-user', {
        body: { userId: currentUser.id },
      })

      if (invokeError) {
        let errorMessage = invokeError.message
        if (invokeError.context && typeof invokeError.context.json === 'function') {
          try {
            const errorBody = await invokeError.context.json()
            errorMessage = errorBody?.error || invokeError.message
          } catch {
            // body 파싱 실패 시 원본 메시지 사용
          }
        }
        throw new Error(errorMessage)
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      await supabase.auth.signOut()
      localStorage.removeItem('user')
      navigate('/login', { replace: true })
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
      <LoadingPopup isOpen={loadingUserInfo} message="사용자 정보 로드 중..." />
      <Navbar />
      <main className="mypage-main">
        <div className="mypage-container">
          <div className="mypage-header">
            <button className="btn btn-back" onClick={handleBack}>
              &larr; 뒤로가기
            </button>
            <h2 className="mypage-title">설정</h2>
          </div>

          {/* User Information Section */}
          <div className="mypage-user-info-section">
            {userInfoError && (
              <div className="error-banner">{userInfoError}</div>
            )}
            {user && (
              <div className="user-info-card">
                <div className="user-info-item">
                  <span className="user-info-label">이메일</span>
                  <span className="user-info-value">{email || '-'}</span>
                </div>
                <div className="user-info-item">
                  <span className="user-info-label">이름</span>
                  <span className="user-info-value">{user.name || '-'}</span>
                </div>
                <div className="user-info-item">
                  <span className="user-info-label">가입일</span>
                  <span className="user-info-value">{formatDate(createdAt)}</span>
                </div>
              </div>
            )}
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
