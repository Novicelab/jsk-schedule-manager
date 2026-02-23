import { useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../../lib/supabase'

const TYPE_LABEL = {
  VACATION: '휴가',
  WORK: '업무',
}

function ScheduleDetail({ schedule, onEdit, onDeleted, onClose }) {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      // Soft delete: deleted_at 설정
      const { error } = await supabase
        .from('schedules')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', schedule.id)

      if (error) throw error

      // 알림 발송 (Edge Function, fire-and-forget)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single()

      supabase.functions.invoke('send-notification', {
        body: { scheduleId: schedule.id, actionType: 'DELETED', actorUserId: currentUser?.id },
      }).catch(err => console.error('알림 발송 실패:', err))

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
    <div className="modal-overlay" onClick={onClose}>
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
            onClick={onClose}
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
            onClick={onClose}
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
  )
}

export default ScheduleDetail
