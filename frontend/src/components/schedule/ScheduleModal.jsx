import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from '../../lib/supabase'
import LoadingPopup from '../LoadingPopup'
import './ScheduleModal.css'

const SCHEDULE_TYPES = [
  { value: 'VACATION', label: '휴가' },
  { value: 'WORK', label: '업무' },
]

const VACATION_TYPES = [
  { value: 'FULL', label: '일반' },
  { value: 'HALF_AM', label: '오전 반차' },
  { value: 'HALF_PM', label: '오후 반차' },
]

function ScheduleModal({ defaultDate, schedule, onSaved, onClose }) {
  const isEdit = !!schedule

  // 기본 날짜 계산
  const defaultDateObj = defaultDate ? dayjs(defaultDate).toDate() : dayjs().toDate()

  const [form, setForm] = useState({
    type: 'VACATION',
    title: '',
    description: '',
    startDate: defaultDateObj,
    endDate: defaultDateObj,
    vacationType: 'FULL',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [notifyWarning, setNotifyWarning] = useState(false)

  // 수정 모드일 때 기존 데이터 주입
  useEffect(() => {
    if (isEdit && schedule) {
      const startAtDayjs = dayjs(schedule.startAt)
      const endAtDayjs = dayjs(schedule.endAt)

      setForm({
        type: schedule.type || 'WORK',
        title: schedule.type === 'WORK' ? (schedule.title || '') : '',
        description: schedule.description || '',
        startDate: startAtDayjs.toDate(),
        endDate: endAtDayjs.toDate(),
        vacationType: schedule.vacationType || 'FULL',
      })
    }
  }, [isEdit, schedule])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
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

    if (!form.startDate) {
      newErrors.startDate = '시작 날짜는 필수입니다.'
    }
    if (!form.endDate) {
      newErrors.endDate = '종료 날짜는 필수입니다.'
    }
    if (form.startDate && form.endDate && dayjs(form.endDate).isBefore(dayjs(form.startDate))) {
      newErrors.endDate = '종료 날짜는 시작 날짜 이후여야 합니다.'
    }

    if (form.type === 'WORK') {
      if (!form.title.trim()) {
        newErrors.title = '제목은 필수입니다.'
      } else if (form.title.trim().length > 100) {
        newErrors.title = '제목은 100자 이내로 입력해주세요.'
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

    try {
      let start_at, end_at, all_day, title, vacation_type
      let notifyFailed = false

      if (form.type === 'WORK') {
        start_at = dayjs(form.startDate).format('YYYY-MM-DD') + 'T00:00:00'
        end_at = dayjs(form.endDate).format('YYYY-MM-DD') + 'T23:59:59'
        all_day = true
        title = form.title.trim()
        vacation_type = null
      } else {
        start_at = dayjs(form.startDate).format('YYYY-MM-DD') + 'T00:00:00'
        // 반차인 경우 startDate와 endDate가 같음, 일반인 경우 endDate 사용
        end_at = (form.vacationType === 'FULL')
          ? dayjs(form.endDate).format('YYYY-MM-DD') + 'T23:59:59'
          : dayjs(form.startDate).format('YYYY-MM-DD') + 'T23:59:59'
        all_day = true
        title = '' // DB 트리거가 vacation_type 기반으로 자동 생성
        vacation_type = form.vacationType
      }

      // 현재 사용자 ID 조회
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single()

      if (isEdit) {
        const updatePayload = {
          title,
          description: form.type === 'WORK' ? (form.description.trim() || null) : null,
          type: form.type,
          start_at,
          end_at,
          all_day,
        }
        if (form.type === 'VACATION') {
          updatePayload.vacation_type = vacation_type
        }
        const { error } = await supabase
          .from('schedules')
          .update(updatePayload)
          .eq('id', schedule.id)

        if (error) throw error

        // 알림 발송 (백엔드 API - 실패해도 계속 진행)
        try {
          const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001').trim()
          const notifyRes = await fetch(`${backendUrl}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId: schedule.id,
              actionType: 'UPDATED',
              actorUserId: currentUser.id,
            }),
          })
          if (!notifyRes.ok) {
            notifyFailed = true
            console.warn('알림 발송 실패: HTTP', notifyRes.status)
          }
        } catch (err) {
          console.warn('알림 발송 실패:', err)
          notifyFailed = true
        }
      } else {
        const insertPayload = {
          title,
          description: form.type === 'WORK' ? (form.description.trim() || null) : null,
          type: form.type,
          start_at,
          end_at,
          all_day,
          created_by: currentUser.id,
        }
        if (form.type === 'VACATION') {
          insertPayload.vacation_type = vacation_type
        }
        const { data: newSchedule, error } = await supabase
          .from('schedules')
          .insert(insertPayload)
          .select()
          .single()

        if (error) throw error

        // 알림 발송 (백엔드 API - 실패해도 계속 진행)
        try {
          const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001').trim()
          const notifyRes = await fetch(`${backendUrl}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId: newSchedule.id,
              actionType: 'CREATED',
              actorUserId: currentUser.id,
            }),
          })
          if (!notifyRes.ok) {
            notifyFailed = true
            console.warn('알림 발송 실패: HTTP', notifyRes.status)
          }
        } catch (err) {
          console.warn('알림 발송 실패:', err)
          notifyFailed = true
        }
      }

      // 알림 실패 시 경고 표시하고 2초 후 onSaved() 호출, 성공 시 즉시 호출
      if (notifyFailed) {
        setNotifyWarning(true)
        setTimeout(() => onSaved(), 2000)
      } else {
        onSaved()
      }
    } catch (err) {
      console.error('일정 저장 실패:', err)
      const message = err.message || '일정 저장 중 오류가 발생했습니다.'
      setApiError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <LoadingPopup isOpen={submitting} message={isEdit ? '일정 수정 중...' : '일정 생성 중...'} />
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
        {notifyWarning && <div className="warning-banner">일정이 저장되었습니다. 카카오 알림 발송에 실패했습니다.</div>}

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {/* Step 1: 유형 선택 */}
          <div className="form-group">
            <label className="form-label">
              유형 선택 <span className="required">*</span>
            </label>
            <div className="type-box-group">
              {SCHEDULE_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`type-box ${form.type === t.value ? 'type-box-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={form.type === t.value}
                    onChange={handleTypeChange}
                    className="type-radio"
                  />
                  <span className="type-box-label">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: VACATION */}
          {form.type === 'VACATION' && (
            <>
              <p className="form-section-hint">
                휴가 유형과 기간을 선택해주세요. 저장 시 제목은 자동으로 생성됩니다.
              </p>

              <div className="form-group">
                <label className="form-label">
                  휴가 유형 <span className="required">*</span>
                </label>
                <div className="type-box-group">
                  {VACATION_TYPES.map((v) => (
                    <label
                      key={v.value}
                      className={`type-box ${form.vacationType === v.value ? 'type-box-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="vacationType"
                        value={v.value}
                        checked={form.vacationType === v.value}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            vacationType: e.target.value,
                            // 반차인 경우 endDate를 startDate로 자동 설정
                            endDate: e.target.value !== 'FULL' ? prev.startDate : prev.endDate,
                          }))
                        }}
                        className="type-radio"
                      />
                      <span className="type-box-label">{v.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  휴가 기간 <span className="required">*</span>
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
                  {form.vacationType === 'FULL' && (
                    <>
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
                    </>
                  )}
                </div>
                {errors.startDate && (
                  <span className="field-error">{errors.startDate}</span>
                )}
                {errors.endDate && (
                  <span className="field-error">{errors.endDate}</span>
                )}
              </div>
            </>
          )}

          {/* Step 3: WORK */}
          {form.type === 'WORK' && (
            <>
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
                  설명 <span className="optional">(선택)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  className="form-input form-textarea"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="일정 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  일정 날짜 <span className="required">*</span>
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
            </>
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
    </>
  )
}

export default ScheduleModal
