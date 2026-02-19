import { useState } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../api/client'

function InviteModal({ teamId, teamName, onInvited, onClose }) {
  const [kakaoId, setKakaoId] = useState('')
  const [error, setError] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  const validate = () => {
    if (!kakaoId.trim()) {
      return '카카오 ID를 입력해주세요.'
    }
    if (!/^\d+$/.test(kakaoId.trim())) {
      return '카카오 ID는 숫자만 입력 가능합니다.'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setApiError(null)
    setError(null)

    try {
      const response = await apiClient.post(
        `/teams/${teamId}/invitations`,
        { kakaoId: Number(kakaoId.trim()) }
      )
      setInviteResult(response.data.data)
    } catch (err) {
      console.error('팀원 초대 실패:', err)
      const message =
        err.response?.data?.message || '초대 중 오류가 발생했습니다.'
      setApiError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKakaoIdChange = (e) => {
    setKakaoId(e.target.value)
    if (error) setError(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >
        <div className="modal-header">
          <h2 id="invite-modal-title" className="modal-title">
            팀원 초대 ({teamName})
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

        {inviteResult ? (
          // 초대 성공 화면
          <div className="invite-result">
            <p className="invite-success-msg">초대가 성공적으로 발송되었습니다.</p>
            <div className="invite-detail">
              {inviteResult.token && (
                <div className="detail-row">
                  <span className="detail-label">초대 토큰</span>
                  <span className="detail-value invite-token">
                    {inviteResult.token}
                  </span>
                </div>
              )}
              {inviteResult.expiresAt && (
                <div className="detail-row">
                  <span className="detail-label">만료 일시</span>
                  <span className="detail-value">
                    {dayjs(inviteResult.expiresAt).format(
                      'YYYY년 MM월 DD일 HH:mm'
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          // 초대 입력 폼
          <form onSubmit={handleSubmit} className="modal-form" noValidate>
            <div className="form-group">
              <label htmlFor="kakaoId" className="form-label">
                카카오 ID <span className="required">*</span>
              </label>
              <input
                id="kakaoId"
                name="kakaoId"
                type="text"
                className={`form-input ${error ? 'input-error' : ''}`}
                value={kakaoId}
                onChange={handleKakaoIdChange}
                placeholder="초대할 사용자의 카카오 ID를 입력하세요"
                inputMode="numeric"
              />
              {error && <span className="field-error">{error}</span>}
              <p className="form-hint">
                카카오 ID는 카카오 계정의 고유 숫자 ID입니다.
              </p>
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
                {submitting ? '초대 중...' : '초대 발송'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default InviteModal
