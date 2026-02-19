import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../api/client'

const SCHEDULE_TYPES = [
  { value: 'TEAM', label: '팀 일정' },
  { value: 'VACATION', label: '휴가' },
]

function ScheduleModal({ teamId, defaultDate, schedule, onSaved, onClose }) {
  const isEdit = !!schedule

  const defaultStart = defaultDate
    ? dayjs(defaultDate).format('YYYY-MM-DDTHH:mm')
    : dayjs().format('YYYY-MM-DDTHH:mm')
  const defaultEnd = defaultDate
    ? dayjs(defaultDate).add(1, 'hour').format('YYYY-MM-DDTHH:mm')
    : dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm')

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'TEAM',
    startAt: defaultStart,
    endAt: defaultEnd,
    allDay: false,
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)

  // 수정 모드일 때 기존 데이터 주입
  useEffect(() => {
    if (isEdit && schedule) {
      setForm({
        title: schedule.title || '',
        description: schedule.description || '',
        type: schedule.type || 'TEAM',
        startAt: schedule.startAt
          ? dayjs(schedule.startAt).format('YYYY-MM-DDTHH:mm')
          : defaultStart,
        endAt: schedule.endAt
          ? dayjs(schedule.endAt).format('YYYY-MM-DDTHH:mm')
          : defaultEnd,
        allDay: schedule.allDay || false,
      })
    }
  }, [isEdit, schedule])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    // 입력 시 해당 필드 에러 초기화
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.title.trim()) {
      newErrors.title = '제목은 필수입니다.'
    } else if (form.title.trim().length > 100) {
      newErrors.title = '제목은 100자 이내로 입력해주세요.'
    }
    if (!form.startAt) {
      newErrors.startAt = '시작 일시는 필수입니다.'
    }
    if (!form.endAt) {
      newErrors.endAt = '종료 일시는 필수입니다.'
    }
    if (form.startAt && form.endAt && !form.allDay) {
      if (dayjs(form.endAt).isBefore(dayjs(form.startAt)) ||
          dayjs(form.endAt).isSame(dayjs(form.startAt))) {
        newErrors.endAt = '종료 일시는 시작 일시보다 이후여야 합니다.'
      }
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

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      startAt: dayjs(form.startAt).toISOString(),
      endAt: dayjs(form.endAt).toISOString(),
      allDay: form.allDay,
    }

    try {
      if (isEdit) {
        await apiClient.put(
          `/teams/${teamId}/schedules/${schedule.id}`,
          payload
        )
      } else {
        await apiClient.post(`/teams/${teamId}/schedules`, payload)
      }
      onSaved()
    } catch (err) {
      console.error('일정 저장 실패:', err)
      const message =
        err.response?.data?.message || '일정 저장 중 오류가 발생했습니다.'
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
        aria-labelledby="schedule-modal-title"
      >
        <div className="modal-header">
          <h2 id="schedule-modal-title" className="modal-title">
            {isEdit ? '일정 수정' : '일정 생성'}
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
            <label htmlFor="title" className="form-label">
              제목 <span className="required">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className={`form-input ${errors.title ? 'input-error' : ''}`}
              value={form.title}
              onChange={handleChange}
              placeholder="일정 제목을 입력하세요"
              maxLength={100}
            />
            {errors.title && (
              <span className="field-error">{errors.title}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              설명
            </label>
            <textarea
              id="description"
              name="description"
              className="form-input form-textarea"
              value={form.description}
              onChange={handleChange}
              placeholder="일정 설명을 입력하세요 (선택)"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="type" className="form-label">
              유형 <span className="required">*</span>
            </label>
            <select
              id="type"
              name="type"
              className="form-input"
              value={form.type}
              onChange={handleChange}
            >
              {SCHEDULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group form-checkbox-group">
            <label className="form-label form-checkbox-label">
              <input
                type="checkbox"
                name="allDay"
                checked={form.allDay}
                onChange={handleChange}
              />
              종일 일정
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startAt" className="form-label">
                시작 일시 <span className="required">*</span>
              </label>
              <input
                id="startAt"
                name="startAt"
                type={form.allDay ? 'date' : 'datetime-local'}
                className={`form-input ${errors.startAt ? 'input-error' : ''}`}
                value={
                  form.allDay
                    ? form.startAt.substring(0, 10)
                    : form.startAt
                }
                onChange={handleChange}
              />
              {errors.startAt && (
                <span className="field-error">{errors.startAt}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="endAt" className="form-label">
                종료 일시 <span className="required">*</span>
              </label>
              <input
                id="endAt"
                name="endAt"
                type={form.allDay ? 'date' : 'datetime-local'}
                className={`form-input ${errors.endAt ? 'input-error' : ''}`}
                value={
                  form.allDay ? form.endAt.substring(0, 10) : form.endAt
                }
                onChange={handleChange}
              />
              {errors.endAt && (
                <span className="field-error">{errors.endAt}</span>
              )}
            </div>
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
              {submitting ? '저장 중...' : isEdit ? '수정 완료' : '일정 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ScheduleModal
