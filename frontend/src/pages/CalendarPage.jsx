import { useState, useEffect, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayjs from 'dayjs'
import Navbar from '../components/Navbar'
import ScheduleModal from '../components/schedule/ScheduleModal'
import ScheduleDetail from '../components/schedule/ScheduleDetail'
import { supabase } from '../lib/supabase'

// 일정 유형별 색상
const SCHEDULE_COLORS = {
  VACATION_FULL: '#7b1fa2',    // 짙은 보라 (일반 휴가, 키 컬러)
  VACATION_HALF_AM: '#82d9a5', // 연한 연두 (오전 반차)
  VACATION_HALF_PM: '#82d9a5', // 연한 연두 (오후 반차)
  WORK: '#bdbdbd',             // 연한 그레이 (업무)
}

function CalendarPage() {
  const [events, setEvents] = useState([])
  const [currentRange, setCurrentRange] = useState(null)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showScheduleDetail, setShowScheduleDetail] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null)

  const [schedulesError, setSchedulesError] = useState(null)

  // 모바일 반응형 UI
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showDatePopup, setShowDatePopup] = useState(false)
  const [clickedDate, setClickedDate] = useState(null)
  const [clickedDateEvents, setClickedDateEvents] = useState([])

  const calendarRef = useRef(null)
  const resizeTimeoutRef = useRef(null)
  const touchStartXRef = useRef(null)

  // 색상 결정 함수
  const getEventColor = (schedule) => {
    if (schedule.type === 'VACATION') {
      const key = `VACATION_${schedule.vacation_type || 'FULL'}`
      return SCHEDULE_COLORS[key] || SCHEDULE_COLORS.VACATION_FULL
    }
    return SCHEDULE_COLORS[schedule.type] || '#7f8c8d'
  }

  // 휴가 타입 라벨
  const VACATION_TYPE_LABEL = {
    FULL: '휴가',
    HALF_AM: '오전 반차',
    HALF_PM: '오후 반차',
  }

  // 이벤트 콘텐츠 렌더링 (모바일 최적화)
  const renderEventContent = (info) => {
    const { type, vacationType, createdByName } = info.event.extendedProps

    if (type === 'VACATION') {
      const vacLabel = VACATION_TYPE_LABEL[vacationType] || '휴가'
      const vacationTypeClass = `vacation-${vacationType || 'FULL'}`
      return (
        <div className={`mobile-event-content vacation-event ${vacationTypeClass}`}>
          <div className="event-name">[{createdByName}]</div>
          <div className="event-type">{vacLabel}</div>
        </div>
      )
    }

    // WORK 타입
    return (
      <div className="mobile-event-content work-event">
        <div className="event-title">{info.event.title}</div>
      </div>
    )
  }

  // 터치 스와이프로 이전/다음 달 이동
  const handleTouchStart = useCallback((e) => {
    touchStartXRef.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (touchStartXRef.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
    touchStartXRef.current = null
    if (Math.abs(deltaX) < 50) return // 50px 미만은 무시
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (deltaX < 0) {
      api.next()  // 왼쪽 스와이프 → 다음 달
    } else {
      api.prev()  // 오른쪽 스와이프 → 이전 달
    }
  }, [])

  // 윈도우 리사이즈 감지 (debounced)
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
      resizeTimeoutRef.current = setTimeout(() => {
        setIsMobile(window.innerWidth < 768)
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
    }
  }, [])

  // 일정 목록 로드
  const loadSchedules = useCallback(async (range) => {
    if (!range) return
    try {
      const startDate = dayjs(range.start).startOf('day').format('YYYY-MM-DDTHH:mm:ss')
      const endDate = dayjs(range.end).endOf('day').format('YYYY-MM-DDTHH:mm:ss')

      // Supabase에서 일정 조회 (뷰 사용)
      const { data: scheduleList, error } = await supabase
        .from('schedules_with_user')
        .select('*')
        .gte('end_at', startDate)
        .lte('start_at', endDate)

      if (error) throw error

      const calendarEvents = (scheduleList || []).map((s) => {
        const color = getEventColor(s)
        return {
          id: String(s.id),
          title: s.title,
          start: s.start_at,
          end: s.all_day
            ? dayjs(s.end_at).add(1, 'day').format('YYYY-MM-DD')
            : s.end_at,
          allDay: s.all_day,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            type: s.type,
            vacationType: s.vacation_type,
            description: s.description,
            createdBy: s.created_by,
            createdByName: s.created_by_name,
          },
        }
      })
      setEvents(calendarEvents)
      setSchedulesError(null)
    } catch (err) {
      console.error('일정 로드 실패:', err)
      setSchedulesError('일정을 불러오지 못했습니다.')
    }
  }, [])

  // 날짜 범위 변경 시 재조회
  useEffect(() => {
    if (currentRange) {
      loadSchedules(currentRange)
    }
  }, [currentRange, loadSchedules])

  // FullCalendar 뷰 범위 변경 콜백
  const handleDatesSet = useCallback((dateInfo) => {
    setCurrentRange({ start: dateInfo.start, end: dateInfo.end })
  }, [])

  // 날짜 클릭 → 모바일: 팝업 표시, 데스크톱: 모달 열기
  const handleDateClick = useCallback((info) => {
    if (isMobile) {
      const dateStr = info.dateStr
      const dayEvents = events.filter(e =>
        dayjs(e.start).format('YYYY-MM-DD') <= dateStr &&
        dayjs(e.end || e.start).format('YYYY-MM-DD') >= dateStr
      )
      setClickedDate(dateStr)
      setClickedDateEvents(dayEvents)
      setShowDatePopup(true)
    } else {
      setSelectedDate(info.dateStr)
      setEditingSchedule(null)
      setShowScheduleModal(true)
    }
  }, [isMobile, events])

  // 일정 상세 정보 조회 (공통 로직)
  const handleEventDetail = useCallback(async (scheduleId) => {
    try {
      const { data, error } = await supabase
        .from('schedules_with_user')
        .select('*')
        .eq('id', scheduleId)
        .single()

      if (error) throw error

      // 내 일정 여부: localStorage의 user.id와 created_by 비교
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const isMySchedule = data.created_by === currentUser.id

      // 필드명 매핑 (snake_case → camelCase)
      setSelectedSchedule({
        id: data.id,
        title: data.title,
        startAt: data.start_at,
        endAt: data.end_at,
        allDay: data.all_day,
        type: data.type,
        vacationType: data.vacation_type,
        description: data.description,
        createdBy: data.created_by,
        createdByName: data.created_by_name,
        createdAt: data.created_at,
        canEdit: isMySchedule,
        canDelete: isMySchedule,
      })
      setShowScheduleDetail(true)
    } catch (err) {
      console.error('일정 상세 조회 실패:', err)
      setSchedulesError('일정 상세 정보를 불러오지 못했습니다.')
    }
  }, [])

  // 이벤트 클릭 → 모바일: 무시, PC: 상세 모달 표시
  const handleEventClick = useCallback(
    async (info) => {
      if (isMobile) return
      handleEventDetail(info.event.id)
    },
    [isMobile, handleEventDetail]
  )

  // 일정 저장 완료 후 목록 새로고침
  const handleScheduleSaved = useCallback(() => {
    setShowScheduleModal(false)
    setEditingSchedule(null)
    if (currentRange) {
      loadSchedules(currentRange)
    }
  }, [currentRange, loadSchedules])

  // 일정 삭제 완료 후 목록 새로고침
  const handleScheduleDeleted = useCallback(() => {
    setShowScheduleDetail(false)
    setSelectedSchedule(null)
    if (currentRange) {
      loadSchedules(currentRange)
    }
  }, [currentRange, loadSchedules])

  // 상세 화면에서 수정 버튼 클릭
  const handleEditFromDetail = useCallback((schedule) => {
    setEditingSchedule(schedule)
    setShowScheduleDetail(false)
    setShowScheduleModal(true)
  }, [])

  return (
    <div className="page-layout">
      <Navbar />
      <main className="calendar-main">
        <div className="calendar-toolbar">
          <div className="color-legend">
            <span className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: SCHEDULE_COLORS.VACATION_FULL }}
              />
              휴가 (일반)
            </span>
            <span className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: SCHEDULE_COLORS.VACATION_HALF_AM }}
              />
              휴가 (반차)
            </span>
            <span className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: SCHEDULE_COLORS.WORK }}
              />
              업무
            </span>
          </div>
        </div>

        {schedulesError && (
          <div className="error-banner">{schedulesError}</div>
        )}

        <div
          className="calendar-container"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ko"
            headerToolbar={{
              left: 'prev',
              center: 'title',
              right: 'next',
            }}
            events={events}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={isMobile ? renderEventContent : undefined}
            dayMaxEvents={false}
            height="700px"
            selectable={true}
            editable={false}
            eventDisplay="block"
          />
        </div>
      </main>

      {showScheduleModal && (
        <ScheduleModal
          defaultDate={selectedDate}
          schedule={editingSchedule}
          onSaved={handleScheduleSaved}
          onClose={() => {
            setShowScheduleModal(false)
            setEditingSchedule(null)
          }}
        />
      )}

      {showScheduleDetail && selectedSchedule && (
        <ScheduleDetail
          schedule={selectedSchedule}
          onEdit={handleEditFromDetail}
          onDeleted={handleScheduleDeleted}
          onClose={() => {
            setShowScheduleDetail(false)
            setSelectedSchedule(null)
          }}
        />
      )}

      {/* 모바일 날짜 이벤트 팝업 */}
      {showDatePopup && (
        <div className="date-popup-overlay" onClick={() => setShowDatePopup(false)}>
          <div
            className="date-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="date-popup-header">
              <h3>{dayjs(clickedDate).format('YYYY년 MM월 DD일')}</h3>
              <button
                className="date-popup-close"
                onClick={() => setShowDatePopup(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="date-popup-content">
              {clickedDateEvents.length > 0 ? (
                <ul className="date-events-list">
                  {clickedDateEvents.map((event) => (
                    <li
                      key={event.id}
                      className="date-event-item"
                      onClick={() => {
                        handleEventDetail(event.id)
                        setShowDatePopup(false)
                      }}
                    >
                      <span
                        className="date-event-dot"
                        style={{ backgroundColor: event.backgroundColor }}
                      />
                      <span className="date-event-title">{event.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="date-no-events">일정이 없습니다.</p>
              )}
            </div>

            <div className="date-popup-footer">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedDate(clickedDate)
                  setEditingSchedule(null)
                  setShowScheduleModal(true)
                  setShowDatePopup(false)
                }}
              >
                일정 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarPage
