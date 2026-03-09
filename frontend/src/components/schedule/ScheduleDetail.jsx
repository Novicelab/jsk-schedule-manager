import { useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../../lib/supabase'
import LoadingPopup from '../LoadingPopup'
import './ScheduleDetail.css'

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
      // 세션 취득: Authorization 헤더 명시적 전달 (Edge Function 토큰 검증용)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
      }

      // Soft delete: Edge Function 사용 (RLS 우회, Service Role)
      const { data, error: invokeError } = await supabase.functions.invoke('soft-delete-schedule', {
        body: { scheduleId: schedule.id },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (invokeError) {
        // FunctionsHttpError인 경우 response body에서 실제 에러 정보 추출
        let errorMessage = invokeError.message
        if (invokeError.context && typeof invokeError.context.json === 'function') {
          try {
            const errorBody = await invokeError.context.json()
            errorMessage = errorBody?.error || errorBody?.message || invokeError.message
            console.error('Edge Function 에러 상세:', errorBody)
          } catch (parseErr) {
            console.warn('Edge Function 에러 body 파싱 실패:', parseErr)
          }
        }
        throw new Error(errorMessage)
      }

      if (data?.error) {
        throw new Error(data.error)
      }

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
            <div className="detail-row">
              <span className="detail-label">설명</span>
              <span className="detail-value">{schedule.description}</span>
            </div>
          )}

          {schedule.type === 'WORK' && schedule.createdByName && (
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

        <div className="modal-footer detail-modal-footer">
          {/* 1. 삭제 버튼 (좌측) */}
          {schedule.canDelete && (
            <button
              className={`btn btn-danger${confirmDelete ? ' btn-danger-confirm' : ''}`}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? '삭제 중...'
                : confirmDelete
                ? '삭제하시겠어요?'
                : '삭제'}
            </button>
          )}

          {/* 2. 수정 버튼 (중앙) */}
          {schedule.canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => onEdit(schedule)}
            >
              수정
            </button>
          )}

          {/* 3. 닫기 버튼 (우측) */}
          <button
            className="btn btn-secondary"
            onClick={handleClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

export default ScheduleDetail
