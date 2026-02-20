import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import apiClient from '../../api/client'
import './ScheduleModal.css'

const SCHEDULE_TYPES = [
  { value: 'WORK', label: '업무' },
  { value: 'VACATION', label: '휴가' },
]

const DURATIONS = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 240, label: '4시간' },
  { value: 480, label: '8시간' },
]

function ScheduleModal({ defaultDate, schedule, onSaved, onClose }) {
  const isEdit = !!schedule

  // 기본 날짜 계산
  const defaultDateObj = defaultDate ? dayjs(defaultDate).toDate() : dayjs().toDate()

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'VACATION',
    startDate: defaultDateObj, // Date 객체 (DatePicker용)
    endDate: defaultDateObj,   // Date 객체 (DatePicker용)
    startTime: '09:00',        // 업무일정용 시작 시간 (HH:mm)
    duration: 60,              // 업무일정용 소요 시간 (분)
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)

  // 수정 모드일 때 기존 데이터 주입
  useEffect(() => {
    if (isEdit && schedule) {
      const startAtDayjs = dayjs(schedule.startAt)
      const endAtDayjs = dayjs(schedule.endAt)

      let calculatedDuration = 60
      if (schedule.startAt && schedule.endAt) {
        calculatedDuration = endAtDayjs.diff(startAtDayjs, 'minute')
      }

      setForm({
        title: schedule.title || '',
        description: schedule.description || '',
        type: schedule.type || 'WORK',
        startDate: startAtDayjs.toDate(),
        endDate: endAtDayjs.toDate(),
        startTime: startAtDayjs.format('HH:mm'),
        duration: calculatedDuration,
      })
    }
  }, [isEdit, schedule])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
    // 입력 시 해당 필드 에러 초기화
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const handleTypeChange = (e) => {
    const { value } = e.target
    setForm((prev) => ({
      ...prev,
      type: value,
    }))
    if (errors.type) {
      setErrors((prev) => ({ ...prev, type: null }))
    }
  }

  const handleStartDateChange = (date) => {
    setForm((prev) => ({
      ...prev,
      startDate: date,
      // 종료일이 시작일보다 이전이면 종료일을 시작일로 맞춤
      endDate: dayjs(date).isAfter(prev.endDate) ? date : prev.endDate,
    }))
    if (errors.startDate) {
      setErrors((prev) => ({ ...prev, startDate: null }))
    }
  }

  const handleEndDateChange = (date) => {
    setForm((prev) => ({
      ...prev,
      endDate: date,
    }))
    if (errors.endDate) {
      setErrors((prev) => ({ ...prev, endDate: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.title.trim()) {
      newErrors.title = '제목은 필수입니다.'
    } else if (form.title.trim().length > 100) {
      newErrors.title = '제목은 100자 이내로 입력해주세요.'
    }
    if (!form.startDate) {
      newErrors.startDate = '시작 날짜는 필수입니다.'
    }
    if (!form.endDate) {
      newErrors.endDate = '종료 날짜는 필수입니다.'
    }
    if (form.startDate && form.endDate && dayjs(form.endDate).isBefore(dayjs(form.startDate))) {
      newErrors.endDate = '종료 날짜는 시작 날짜 이후여야 합니다.'
    }
    if (form.type === 'WORK' && !form.startTime) {
      newErrors.startTime = '시작 시간은 필수입니다.'
    }
    if (form.type === 'WORK' && !form.duration) {
      newErrors.duration = '소요 시간은 필수입니다.'
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
      let startAt, endAt, allDay

      if (form.type === 'WORK') {
        // 업무일정: 시작 날짜 + 시작 시간 + 소요 시간
        const startDateTime = dayjs(form.startDate).format('YYYY-MM-DD') + 'T' + form.startTime + ':00'
        const endDateTime = dayjs(startDateTime).add(form.duration, 'minute').format('YYYY-MM-DDTHH:mm:ss')
        startAt = startDateTime
        endAt = endDateTime
        allDay = false
      } else {
        // 휴가: 시작 날짜 ~ 종료 날짜 (시간 없음)
        startAt = dayjs(form.startDate).format('YYYY-MM-DD') + 'T00:00:00'
        endAt = dayjs(form.endDate).format('YYYY-MM-DD') + 'T23:59:59'
        allDay = true
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        startAt,
        endAt,
        allDay,
      }

      if (isEdit) {
        await apiClient.put(`/schedules/${schedule.id}`, payload)
      } else {
        await apiClient.post('/schedules', payload)
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
              onChange={handleInputChange}
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
              onChange={handleInputChange}
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
              onChange={handleTypeChange}
            >
              {SCHEDULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 범위 선택 */}
          <div className="form-group">
            <label className="form-label">
              {form.type === 'WORK' ? '일정 날짜' : '휴가 기간'} <span className="required">*</span>
            </label>
            <div className="date-range-container">
              <div className="date-picker-wrapper">
                <label className="date-label">시작</label>
                <DatePicker
                  selected={form.startDate}
                  onChange={handleStartDateChange}
                  dateFormat="yyyy-MM-dd"
                  className={`form-input date-picker ${errors.startDate ? 'input-error' : ''}`}
                />
              </div>
              <span className="date-separator">→</span>
              <div className="date-picker-wrapper">
                <label className="date-label">종료</label>
                <DatePicker
                  selected={form.endDate}
                  onChange={handleEndDateChange}
                  dateFormat="yyyy-MM-dd"
                  className={`form-input date-picker ${errors.endDate ? 'input-error' : ''}`}
                />
              </div>
            </div>
            {errors.startDate && (
              <span className="field-error">{errors.startDate}</span>
            )}
            {errors.endDate && (
              <span className="field-error">{errors.endDate}</span>
            )}
          </div>

          {/* 시간 선택 (업무 일정에서만) */}
          {form.type === 'WORK' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startTime" className="form-label">
                  시작 시간 <span className="required">*</span>
                </label>
                <input
                  id="startTime"
                  name="startTime"
                  type="time"
                  className={`form-input ${errors.startTime ? 'input-error' : ''}`}
                  value={form.startTime}
                  onChange={handleInputChange}
                />
                {errors.startTime && (
                  <span className="field-error">{errors.startTime}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="duration" className="form-label">
                  소요 시간 <span className="required">*</span>
                </label>
                <select
                  id="duration"
                  name="duration"
                  className="form-input"
                  value={form.duration}
                  onChange={handleInputChange}
                >
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {errors.duration && (
                  <span className="field-error">{errors.duration}</span>
                )}
              </div>
            </div>
          )}

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
