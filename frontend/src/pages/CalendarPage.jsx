import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
  VACATION_FULL: '#7b1fa2',         // 짙은 보라 (일반 휴가, 키 컬러)
  VACATION_HALF_AM: '#82d9a5',      // 연한 연두 (오전 반차)
  VACATION_HALF_PM: '#82d9a5',      // 연한 연두 (오후 반차)
  VACATION_EARLY_LEAVE: '#f59e0b',  // amber (조퇴)
  WORK: '#bdbdbd',                  // 연한 그레이 (업무)
}

function CalendarPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [currentRange, setCurrentRange] = useState(null)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showScheduleDetail, setShowScheduleDetail] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null)

  const [schedulesError, setSchedulesError] = useState(null)
  const [currentTitle, setCurrentTitle] = useState('')

  // 모바일 반응형 UI
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showDatePopup, setShowDatePopup] = useState(false)
  const [clickedDate, setClickedDate] = useState(null)
  const [clickedDateEvents, setClickedDateEvents] = useState([])

  const [slideDirection, setSlideDirection] = useState(null) // 'left' | 'right' | null

  const calendarRef = useRef(null)
  const resizeTimeoutRef = useRef(null)
  const touchStartXRef = useRef(null)
  const touchStartYRef = useRef(null)

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
    EARLY_LEAVE: '조퇴',
  }

  // 이벤트 콘텐츠 렌더링 (모바일 최적화)
  const renderEventContent = (info) => {
    const { type, vacationType, createdByName } = info.event.extendedProps

    if (type === 'VACATION') {
      const vacLabel = VACATION_TYPE_LABEL[vacationType] || '휴가'
      const vacationTypeClass = `vacation-${vacationType || 'FULL'}`
      return (
        <div className={`mobile-event-content vacation-event ${vacationTypeClass}`}>
          <div className="event-name">{createdByName}</div>
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

  // 슬라이드 애니메이션 트리거
  const triggerSlide = useCallback((direction) => {
    setSlideDirection(direction)
    // 애니메이션 완료 후 클래스 제거 (300ms)
    setTimeout(() => setSlideDirection(null), 300)
  }, [])

  // 터치 스와이프로 이전/다음 달 이동
  const handleTouchStart = useCallback((e) => {
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
  }, [])

  // 수평 스와이프 감지 시 브라우저 native 제스처(뒤로가기 등) 차단
  const handleTouchMove = useCallback((e) => {
    if (touchStartXRef.current === null) return
    const deltaX = Math.abs(e.touches[0].clientX - touchStartXRef.current)
    const deltaY = Math.abs(e.touches[0].clientY - (touchStartYRef.current ?? e.touches[0].clientY))
    // 수평 이동이 수직보다 크면 브라우저 기본 동작 차단 (페이지 이동 방지)
    if (deltaX > deltaY && deltaX > 10) {
      e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (touchStartXRef.current === null) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartXRef.current
    const deltaY = touch.clientY - (touchStartYRef.current ?? touch.clientY)
    touchStartXRef.current = null
    touchStartYRef.current = null
    // 수평 이동이 수직 이동보다 크고 50px 이상일 때만 월 이동 (세로 스크롤과 구분)
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (deltaX < 0) {
      triggerSlide('left')
      api.next()  // 왼쪽 스와이프 → 다음 달
    } else {
      triggerSlide('right')
      api.prev()  // 오른쪽 스와이프 → 이전 달
    }
  }, [])

  // 회원가입 완료 확인
  // 세션 감지 및 만료 처리는 PrivateRoute에서 단일 관리 (중복 구독으로 인한 무한 렌더링 방지)
  // 카카오톡 인앱 브라우저 백키 시 onAuthStateChange가 일시적으로 발행되므로
  // CalendarPage에서 별도 구독 시 PrivateRoute와 충돌하여 무한 렌더링 발생
  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
    if (!currentUser.name || currentUser.name === '__PENDING__') {
      navigate('/login', { replace: true })
    }
  }, [navigate])

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
  // 세션 선제 검증은 PrivateRoute에서 처리하므로 여기서는 401 응답만 처리
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

      // 401 Unauthorized: PrivateRoute가 처리하지 못한 토큰 만료
      if (error?.status === 401) {
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

      if (error) throw error

      const calendarEvents = (scheduleList || []).map((s) => {
        const color = getEventColor(s)
        return {
          id: String(s.id),
          title: s.title,
          // allDay 이벤트: start/end 모두 date-only (YYYY-MM-DD) 형식 필요
          // end는 FullCalendar exclusive end date 방식이므로 +1일 처리
          start: s.all_day ? dayjs(s.start_at).format('YYYY-MM-DD') : s.start_at,
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
            rawStartAt: s.start_at,
            rawEndAt: s.end_at,
          },
        }
      })
      setEvents(calendarEvents)
      setSchedulesError(null)
    } catch (err) {
      console.error('일정 로드 실패:', err)
      setSchedulesError('일정을 불러오지 못했습니다.')
    }
  }, [navigate])

  // 날짜 범위 변경 시 재조회
  useEffect(() => {
    if (currentRange) {
      loadSchedules(currentRange)
    }
  }, [currentRange, loadSchedules])

  // 커스텀 헤더 이전/다음 달 이동
  const handlePrev = useCallback(() => {
    triggerSlide('right')
    calendarRef.current?.getApi().prev()
  }, [triggerSlide])

  const handleNext = useCallback(() => {
    triggerSlide('left')
    calendarRef.current?.getApi().next()
  }, [triggerSlide])

  // FullCalendar 뷰 범위 변경 콜백
  const handleDatesSet = useCallback((dateInfo) => {
    setCurrentRange({ start: dateInfo.start, end: dateInfo.end })
    // 표시 중인 달의 중간 날짜로 월 타이틀 계산
    const mid = new Date((dateInfo.start.getTime() + dateInfo.end.getTime()) / 2)
    setCurrentTitle(dayjs(mid).format('YYYY년 M월'))
  }, [])

  // 날짜 클릭 → 모바일: 팝업 표시, 데스크톱: 모달 열기
  const handleDateClick = useCallback((info) => {
    if (isMobile) {
      const dateStr = info.dateStr
      // allDay 이벤트의 e.end는 +1일 처리된 exclusive date이므로 < 비교
      const dayEvents = events.filter(e => {
        const startStr = dayjs(e.start).format('YYYY-MM-DD')
        const endStr = e.end ? dayjs(e.end).format('YYYY-MM-DD') : startStr
        return startStr <= dateStr && dateStr < endStr
      })
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
  // 세션 선제 검증은 PrivateRoute에서 처리하므로 여기서는 401 응답만 처리
  const handleEventDetail = useCallback(async (scheduleId) => {
    try {
      const { data, error } = await supabase
        .from('schedules_with_user')
        .select('*')
        .eq('id', scheduleId)
        .single()

      // 401 Unauthorized: PrivateRoute가 처리하지 못한 토큰 만료
      if (error?.status === 401) {
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

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
  }, [navigate])

  // 이벤트 클릭 → 모바일: 바텀시트 표시, PC: 상세 모달 표시
  const handleEventClick = useCallback(
    async (info) => {
      if (isMobile) {
        // 다일 이벤트: 클릭한 위치의 날짜 셀(data-date)을 탐지하여 해당 날짜 바텀시트 표시
        let dateStr = dayjs(info.event.start).format('YYYY-MM-DD')
        const jsEvent = info.jsEvent
        if (jsEvent) {
          const elements = document.elementsFromPoint(jsEvent.clientX, jsEvent.clientY)
          const dateCell = elements.find(el => el.hasAttribute('data-date'))
          if (dateCell) {
            dateStr = dateCell.getAttribute('data-date')
          }
        }
        const dayEvents = events.filter(e => {
          const startStr = dayjs(e.start).format('YYYY-MM-DD')
          const endStr = e.end ? dayjs(e.end).format('YYYY-MM-DD') : startStr
          return startStr <= dateStr && dateStr < endStr
        })
        setClickedDate(dateStr)
        setClickedDateEvents(dayEvents)
        setShowDatePopup(true)
        return
      }
      handleEventDetail(info.event.id)
    },
    [isMobile, events, handleEventDetail]
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

  // 바텀시트 이벤트 기간 라벨 생성
  const getEventPeriodLabel = (event) => {
    const props = event.extendedProps || {}
    if (props.vacationType === 'EARLY_LEAVE' && props.rawEndAt) {
      return dayjs(props.rawEndAt).format('HH:mm') + ' 조퇴'
    }
    const startStr = dayjs(event.start).format('M/D')
    // allDay 이벤트의 end는 exclusive (+1일 처리됨)이므로 실제 종료일은 -1일
    const endDate = event.end ? dayjs(event.end).subtract(1, 'day') : dayjs(event.start)
    const endStr = endDate.format('M/D')
    return startStr === endStr ? startStr : `${startStr}~${endStr}`
  }

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
                style={{ backgroundColor: SCHEDULE_COLORS.VACATION_EARLY_LEAVE }}
              />
              조퇴
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

        {/* 커스텀 월 네비게이션 헤더 - 터치 플리킹 영역에서 제외 */}
        <div className="calendar-custom-header">
          <button className="calendar-nav-btn" onClick={handlePrev} aria-label="이전 달">&#8249;</button>
          <span className="calendar-nav-title">{currentTitle}</span>
          <button className="calendar-nav-btn" onClick={handleNext} aria-label="다음 달">&#8250;</button>
        </div>

        {/* 날짜 셀 그리드 영역 - 이 영역만 좌우 플리킹 가능 */}
        <div
          className={`calendar-container${slideDirection ? ` slide-${slideDirection}` : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={searchParams.get('month') ? `${searchParams.get('month')}-01` : undefined}
            locale="ko"
            headerToolbar={false}
            events={events}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={isMobile ? renderEventContent : undefined}
            dayMaxEvents={false}
            height="auto"
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
                      <span className="date-event-period">{getEventPeriodLabel(event)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="date-no-events">일정이 없습니다.</p>
              )}
            </div>

            <div className="date-popup-footer">
              <button
                className="btn btn-primary btn-add-schedule"
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
