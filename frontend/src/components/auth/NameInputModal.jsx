import { useState } from 'react'
import apiClient from '../../api/client'
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

    // 유효성 검사
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
      // 사용자 이름 업데이트
      const response = await apiClient.put('/users/me', { name: name.trim() })

      // localStorage의 user 객체 업데이트
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const updatedUser = {
        ...currentUser,
        name: response.data.data.name
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))

      // 완료 콜백
      onComplete()
    } catch (err) {
      console.error('이름 업데이트 실패:', err)
      const message =
        err.response?.data?.message || '이름 입력 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // 배경 클릭 방지 (필수 입력이므로 닫기 불가)
  const handleBackgroundClick = (e) => {
    e.stopPropagation()
  }

  return (
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
  )
}

export default NameInputModal
