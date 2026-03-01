import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingPopup from '../LoadingPopup'
import './NameInputModal.css'

function NameInputModal({ onComplete }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleInputChange = (e) => {
    setName(e.target.value)
    if (error) setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (name.trim().length > 50) {
      setError('이름은 50자 이내로 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      // localStorage에서 사용자 정보 조회
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      console.log('NameInputModal - 저장할 사용자 정보:', {
        userId: currentUser.id,
        name: name.trim(),
        fullUser: currentUser
      })

      if (!currentUser.id) {
        throw new Error('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
      }

      // 세션 검증: 현재 로그인 상태 확인
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('NameInputModal - 세션 상태 (호출 전):', {
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id,
        token: sessionData.session?.access_token ? '있음' : '없음'
      })

      if (!sessionData.session || !sessionData.session.access_token) {
        throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
      }

      // 약간의 딜레이를 추가하여 세션이 완전히 로드되도록 대기
      console.log('세션 안정화 대기 중 (500ms)...')
      await new Promise(resolve => setTimeout(resolve, 500))

      // RLS 정책 우회: Edge Function을 통해 이름 업데이트
      // (Service Role Key로 실행되므로 RLS 정책 제약 없음)
      console.log('update-user-name Edge Function 호출 중...', {
        userId: currentUser.id,
        name: name.trim(),
        accessToken: sessionData.session.access_token ? '있음' : '없음'
      })

      const { data: updateData, error: invokeError } = await supabase.functions.invoke('update-user-name', {
        body: {
          userId: currentUser.id,
          name: name.trim(),
          kakaoId: currentUser.kakaoId
        }
      })

      console.log('update-user-name 응답:', {
        data: updateData,
        error: invokeError
      })

      if (invokeError) {
        console.error('Edge Function 호출 실패:', invokeError)
        throw invokeError
      }

      if (updateData?.error) {
        throw new Error(updateData.error)
      }

      if (!updateData?.user) {
        throw new Error('사용자 정보 업데이트 실패')
      }

      // localStorage의 user 객체 업데이트
      const updatedUser = {
        ...currentUser,
        name: updateData.user.name,
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      console.log('이름 업데이트 완료:', updatedUser)

      onComplete()
    } catch (err) {
      console.error('이름 업데이트 실패:', err)
      const message = err.message || '이름 입력 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBackgroundClick = (e) => {
    e.stopPropagation()
  }

  return (
    <>
      <LoadingPopup isOpen={submitting} message="이름 저장 중..." />
      <div className="name-modal-overlay" onClick={handleBackgroundClick}>
        <div className="name-modal-content">
        <div className="name-modal-header">
          <h2>이름을 입력해주세요</h2>
        </div>

        <div className="name-modal-body">
          <p className="name-modal-description">
            실제 이름을 입력해주세요. 휴가 등록 시 자동으로 사용됩니다.
          </p>
          <p className="name-modal-example">
            예: <strong>홍길동</strong> 입력 → 휴가 저장 시 <strong>[홍길동] 오전 반차</strong>
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <input
                type="text"
                className={`name-input ${error ? 'input-error' : ''}`}
                value={name}
                onChange={handleInputChange}
                placeholder="이름 입력 (최대 50자)"
                maxLength={50}
                autoFocus
                disabled={submitting}
              />
              {error && <span className="field-error">{error}</span>}
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={!name.trim() || submitting}
            >
              {submitting ? '처리 중...' : '확인'}
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  )
}

export default NameInputModal
