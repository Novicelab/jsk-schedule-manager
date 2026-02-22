import { useState, useEffect, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayjs from 'dayjs'
import Navbar from '../components/Navbar'
import ScheduleModal from '../components/schedule/ScheduleModal'
import ScheduleDetail from '../components/schedule/ScheduleDetail'
import apiClient from '../api/client'

// 일정 유형별 색상
const SCHEDULE_COLORS = {
  VACATION: '#27ae60',
  WORK: '#2980b9',
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

  // 윈도우 리사이즈 감지
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 일정 목록 로드
  const loadSchedules = useCallback(async (range) => {
    if (!range) return
    try {
      const response = await apiClient.get('/schedules', {
        params: {
          // 백엔드가 ISO 8601 날짜시간 형식을 기대하므로 LocalDateTime과 호환되는 형식으로 전달
          startDate: dayjs(range.start).startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
          endDate: dayjs(range.end).endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        },
      })
      const scheduleList = response.data.data?.content || response.data.data || []
      const calendarEvents = scheduleList.map((s) => ({
        id: String(s.id),
        title: s.title,
        start: s.startAt,
        end: s.endAt,
        allDay: s.allDay,
        backgroundColor: SCHEDULE_COLORS[s.type] || '#7f8c8d',
        borderColor: SCHEDULE_COLORS[s.type] || '#7f8c8d',
        extendedProps: {
          type: s.type,
          description: s.description,
          createdBy: s.createdBy,
        },
      }))
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

  // 이벤트 클릭 → 일정 상세 모달
  const handleEventClick = useCallback(
    async (info) => {
      const scheduleId = info.event.id
      try {
        const response = await apiClient.get(`/schedules/${scheduleId}`)
        setSelectedSchedule(response.data.data)
        setShowScheduleDetail(true)
      } catch (err) {
        console.error('일정 상세 조회 실패:', err)
        setSchedulesError('일정 상세 정보를 불러오지 못했습니다.')
      }
    },
    []
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
                style={{ backgroundColor: SCHEDULE_COLORS.VACATION }}
              />
              휴가
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
              left: 'prev,next today',
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
            eventContent={isMobile ? (info) => (
              <div className="mobile-event-dot"
                   style={{ backgroundColor: info.backgroundColor }} />
            ) : undefined}
            dayMaxEvents={isMobile ? 1 : false}
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
                          const response = await apiClient.get(`/schedules/${event.id}`)
                          setSelectedSchedule(response.data.data)
                          setShowScheduleDetail(true)
                          setShowDatePopup(false)
                        } catch (err) {
                          console.error('일정 상세 조회 실패:', err)
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
