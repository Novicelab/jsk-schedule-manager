import { useState } from 'react'
import apiClient from '../../api/client'

function TeamCreateModal({ onCreated, onClose }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) {
      newErrors.name = '팀 이름은 필수입니다.'
    } else if (form.name.trim().length > 50) {
      newErrors.name = '팀 이름은 50자 이내로 입력해주세요.'
    }
    if (form.description.length > 500) {
      newErrors.description = '팀 설명은 500자 이내로 입력해주세요.'
    }
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.post('/teams', {
        name: form.name.trim(),
        description: form.description.trim() || null,
      })
      onCreated()
    } catch (err) {
      console.error('팀 생성 실패:', err)
      const message =
        err.response?.data?.message || '팀 생성 중 오류가 발생했습니다.'
      setApiError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-create-title"
      >
        <div className="modal-header">
          <h2 id="team-create-title" className="modal-title">
            팀 생성
          </h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            x
          </button>
        </div>

        {apiError && <div className="error-banner">{apiError}</div>}

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          <div className="form-group">
            <label htmlFor="teamName" className="form-label">
              팀 이름 <span className="required">*</span>
            </label>
            <input
              id="teamName"
              name="name"
              type="text"
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              value={form.name}
              onChange={handleChange}
              placeholder="팀 이름을 입력하세요"
              maxLength={50}
            />
            {errors.name && (
              <span className="field-error">{errors.name}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="teamDescription" className="form-label">
              팀 설명
            </label>
            <textarea
              id="teamDescription"
              name="description"
              className={`form-input form-textarea ${
                errors.description ? 'input-error' : ''
              }`}
              value={form.description}
              onChange={handleChange}
              placeholder="팀에 대한 설명을 입력하세요 (선택)"
              rows={3}
              maxLength={500}
            />
            {errors.description && (
              <span className="field-error">{errors.description}</span>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '생성 중...' : '팀 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TeamCreateModal
