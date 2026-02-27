import { useState, useEffect, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayjs from 'dayjs'
import Navbar from '../components/Navbar'
import ScheduleModal from '../components/schedule/ScheduleModal'
import ScheduleDetail from '../components/schedule/ScheduleDetail'
import { supabase } from '../lib/supabase'

// 일정 유형별 색상
const SCHEDULE_COLORS = {
  VACATION_FULL: '#27ae60',    // 짙은 초록 (일반 휴가)
  VACATION_HALF_AM: '#82d9a5', // 옅은 초록 (오전 반차)
  VACATION_HALF_PM: '#82d9a5', // 옅은 초록 (오후 반차)
  WORK: '#2980b9',             // 파란색
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
      return (
        <div className="mobile-event-content vacation-event">
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
          end: s.end_at,
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

  // 이벤트 클릭 → 모바일: 무시, PC: 상세 모달 표시
  const handleEventClick = useCallback(
    async (info) => {
      if (isMobile) return

      const scheduleId = info.event.id
      try {
        const { data, error } = await supabase
          .from('schedules_with_user')
          .select('*')
          .eq('id', scheduleId)
          .single()

        if (error) throw error

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
          canEdit: data.can_edit,
          canDelete: data.can_delete,
        })
        setShowScheduleDetail(true)
      } catch (err) {
        console.error('일정 상세 조회 실패:', err)
        setSchedulesError('일정 상세 정보를 불러오지 못했습니다.')
      }
    },
    [isMobile]
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

        <div className="calendar-container">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ko"
            headerToolbar={{
              left: 'prev,next',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: '오늘',
              month: '월',
              week: '주',
              day: '일',
            }}
            events={events}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={isMobile ? renderEventContent : undefined}
            dayMaxEvents={isMobile ? false : false}
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
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase
                            .from('schedules_with_user')
                            .select('*')
                            .eq('id', event.id)
                            .single()

                          if (error) throw error

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
                            canEdit: data.can_edit,
                            canDelete: data.can_delete,
                          })
                          setShowDatePopup(false)
                          setShowScheduleDetail(true)
                        } catch (err) {
                          console.error('일정 상세 조회 실패:', err)
                          setSchedulesError('일정 상세 정보를 불러오지 못했습니다.')
                          setShowDatePopup(false)
                        }
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
