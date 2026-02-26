import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from '../../lib/supabase'
import './ScheduleModal.css'

const SCHEDULE_TYPES = [
  { value: 'VACATION', label: '휴가' },
  { value: 'WORK', label: '업무' },
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
    type: 'VACATION',
    title: '',
    description: '',
    startDate: defaultDateObj,
    endDate: defaultDateObj,
    startTime: '09:00',
    duration: 60,
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

      // VACATION인 경우 "[이름] 부제목" 형식에서 부제목만 추출
      let displayTitle = schedule.title || ''
      if (schedule.type === 'VACATION' && displayTitle.includes(']')) {
        const endBracketIndex = displayTitle.indexOf(']')
        displayTitle = displayTitle.substring(endBracketIndex + 1).trim()
      }

      setForm({
        type: schedule.type || 'WORK',
        title: displayTitle,
        description: schedule.description || '',
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
      if (!form.startTime) {
        newErrors.startTime = '시작 시간은 필수입니다.'
      }
      if (!form.duration) {
        newErrors.duration = '소요 시간은 필수입니다.'
      }
    } else if (form.type === 'VACATION') {
      if (form.title.trim().length > 100) {
        newErrors.title = '부제목은 100자 이내로 입력해주세요.'
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
      let start_at, end_at, all_day, title

      if (form.type === 'WORK') {
        const startDateTime = dayjs(form.startDate).format('YYYY-MM-DD') + 'T' + form.startTime + ':00'
        const endDateTime = dayjs(startDateTime).add(form.duration, 'minute').format('YYYY-MM-DDTHH:mm:ss')
        start_at = startDateTime
        end_at = endDateTime
        all_day = false
        title = form.title.trim()
      } else {
        start_at = dayjs(form.startDate).format('YYYY-MM-DD') + 'T00:00:00'
        end_at = dayjs(form.endDate).format('YYYY-MM-DD') + 'T23:59:59'
        all_day = true
        title = form.title.trim() // DB 트리거가 "[이름] 부제목" 형식으로 자동 설정
      }

      // 현재 사용자 ID 조회
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single()

      if (isEdit) {
        const { error } = await supabase
          .from('schedules')
          .update({
            title,
            description: form.type === 'WORK' ? (form.description.trim() || null) : null,
            type: form.type,
            start_at,
            end_at,
            all_day,
          })
          .eq('id', schedule.id)

        if (error) throw error

        // 알림 발송 (Edge Function)
        supabase.functions.invoke('send-notification', {
          body: { scheduleId: schedule.id, actionType: 'UPDATED', actorUserId: currentUser.id },
        }).catch(err => console.error('알림 발송 실패:', err))
      } else {
        const now = new Date().toISOString()
        const { data: newSchedule, error } = await supabase
          .from('schedules')
          .insert({
            title,
            description: form.type === 'WORK' ? (form.description.trim() || null) : null,
            type: form.type,
            start_at,
            end_at,
            all_day,
            created_by: currentUser.id,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single()

        if (error) throw error

        // 알림 발송 (Edge Function)
        supabase.functions.invoke('send-notification', {
          body: { scheduleId: newSchedule.id, actionType: 'CREATED', actorUserId: currentUser.id },
        }).catch(err => console.error('알림 발송 실패:', err))
      }
      onSaved()
    } catch (err) {
      console.error('일정 저장 실패:', err)
      const message = err.message || '일정 저장 중 오류가 발생했습니다.'
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
                휴가 기간을 선택해주세요. 저장 시 제목은 [이름] 휴가 형식으로 자동 생성됩니다.
              </p>

              <div className="form-group">
                <label htmlFor="vacation-title" className="form-label">
                  부제목 <span className="optional">(선택)</span>
                </label>
                <input
                  id="vacation-title"
                  name="title"
                  type="text"
                  className={`form-input ${errors.title ? 'input-error' : ''}`}
                  value={form.title}
                  onChange={handleInputChange}
                  placeholder="예: 오전 반차, 연차 등 (선택 입력)"
                  maxLength={100}
                />
                <p className="form-hint">저장 시 [이름] 휴가 또는 [이름] 부제목 형식으로 자동 추가됩니다.</p>
                {errors.title && (
                  <span className="field-error">{errors.title}</span>
                )}
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
  )
}

export default ScheduleModal
