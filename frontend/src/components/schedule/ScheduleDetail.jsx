import { useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../../lib/supabase'
import LoadingPopup from '../LoadingPopup'

const TYPE_LABEL = {
  VACATION: '휴가',
  WORK: '업무',
}

const VACATION_TYPE_LABEL = {
  FULL: '일반',
  HALF_AM: '오전 반차',
  HALF_PM: '오후 반차',
  EARLY_LEAVE: '조퇴',
}

function ScheduleDetail({ schedule, onEdit, onDeleted, onClose }) {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const handleClose = () => {
    onClose()
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      // Soft delete: Edge Function 사용 (RLS 우회, Service Role)
      const { error } = await supabase.functions.invoke('soft-delete-schedule', {
        body: { scheduleId: schedule.id },
      })

      if (error) throw error

      onDeleted()
    } catch (err) {
      console.error('일정 삭제 실패:', err)
      const message = err.message || '일정 삭제 중 오류가 발생했습니다.'
      setDeleteError(message)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const formatDateTime = (datetime, allDay) => {
    if (!datetime) return '-'
    if (allDay) return dayjs(datetime).format('YYYY년 MM월 DD일')
    return dayjs(datetime).format('YYYY년 MM월 DD일 HH:mm')
  }

  return (
    <>
      <LoadingPopup isOpen={deleting} message="일정 삭제 중..." />
      <div className="modal-overlay" onClick={handleClose}>
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-detail-title"
        >
        <div className="modal-header">
          <h2 id="schedule-detail-title" className="modal-title">
            일정 상세
          </h2>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="닫기"
          >
            x
          </button>
        </div>

        {deleteError && <div className="error-banner">{deleteError}</div>}

        <div className="detail-body">
          <div className="detail-row">
            <span className="detail-label">제목</span>
            <span className="detail-value detail-title">{schedule.title}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">유형</span>
            <span className={`detail-value type-badge type-${schedule.type?.toLowerCase()}`}>
              {TYPE_LABEL[schedule.type] || schedule.type}
              {schedule.type === 'VACATION' && schedule.vacationType && (
                <> ({VACATION_TYPE_LABEL[schedule.vacationType] || schedule.vacationType})</>
              )}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">기간</span>
            <span className="detail-value">
              {formatDateTime(schedule.startAt, schedule.allDay)}
              {' ~ '}
              {formatDateTime(schedule.endAt, schedule.allDay)}
              {schedule.allDay && (
                <span className="all-day-badge"> (종일)</span>
              )}
            </span>
          </div>

          {schedule.vacationType === 'EARLY_LEAVE' && schedule.endAt && (
            <div className="detail-row">
              <span className="detail-label">조퇴 시간</span>
              <span className="detail-value">
                {dayjs(schedule.endAt).format('HH:mm')}
              </span>
            </div>
          )}

          {schedule.description && (
            <div className="detail-row detail-row-column">
              <span className="detail-label">설명</span>
              <p className="detail-description">{schedule.description}</p>
            </div>
          )}

          {schedule.createdByName && (
            <div className="detail-row">
              <span className="detail-label">등록자</span>
              <span className="detail-value">{schedule.createdByName}</span>
            </div>
          )}

          {schedule.createdAt && (
            <div className="detail-row">
              <span className="detail-label">등록일</span>
              <span className="detail-value">
                {dayjs(schedule.createdAt).format('YYYY년 MM월 DD일 HH:mm')}
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
          >
            닫기
          </button>

          {schedule.canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => onEdit(schedule)}
            >
              수정
            </button>
          )}

          {schedule.canDelete && (
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? '삭제 중...'
                : confirmDelete
                ? '정말 삭제하시겠습니까?'
                : '삭제'}
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

export default ScheduleDetail
