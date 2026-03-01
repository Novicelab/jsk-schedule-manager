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

      // users 테이블 이름 업데이트 (user.id로 조회)
      const { data, error: updateError } = await supabase
        .from('users')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', currentUser.id)
        .select()
        .single()

      console.log('NameInputModal - UPDATE 결과:', {
        data,
        error: updateError
      })

      if (updateError) throw updateError

      // localStorage의 user 객체 업데이트
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const updatedUser = {
        ...currentUser,
        name: data.name,
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))

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
