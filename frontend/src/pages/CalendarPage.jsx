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
  TEAM: '#2980b9',
}

function CalendarPage() {
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [events, setEvents] = useState([])
  const [currentRange, setCurrentRange] = useState(null)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showScheduleDetail, setShowScheduleDetail] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null)

  const [teamsError, setTeamsError] = useState(null)
  const [schedulesError, setSchedulesError] = useState(null)

  const calendarRef = useRef(null)

  // 내 팀 목록 로드
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const response = await apiClient.get('/teams')
        const teamList = response.data.data || []
        setTeams(teamList)
        if (teamList.length > 0) {
          setSelectedTeamId(teamList[0].id)
        }
      } catch (err) {
        console.error('팀 목록 로드 실패:', err)
        setTeamsError('팀 목록을 불러오지 못했습니다.')
      }
    }
    loadTeams()
  }, [])

  // 일정 목록 로드
  const loadSchedules = useCallback(async (teamId, range) => {
    if (!teamId || !range) return
    try {
      const response = await apiClient.get(`/teams/${teamId}/schedules`, {
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
          teamId: teamId,
        },
      }))
      setEvents(calendarEvents)
      setSchedulesError(null)
    } catch (err) {
      console.error('일정 로드 실패:', err)
      setSchedulesError('일정을 불러오지 못했습니다.')
    }
  }, [])

  // 팀 또는 날짜 범위 변경 시 재조회
  useEffect(() => {
    if (selectedTeamId && currentRange) {
      loadSchedules(selectedTeamId, currentRange)
    }
  }, [selectedTeamId, currentRange, loadSchedules])

  // FullCalendar 뷰 범위 변경 콜백
  const handleDatesSet = useCallback((dateInfo) => {
    setCurrentRange({ start: dateInfo.start, end: dateInfo.end })
  }, [])

  // 날짜 클릭 → 새 일정 생성 모달
  const handleDateClick = useCallback((info) => {
    if (!selectedTeamId) {
      setSchedulesError('먼저 팀을 선택해주세요.')
      return
    }
    setSelectedDate(info.dateStr)
    setEditingSchedule(null)
    setShowScheduleModal(true)
  }, [selectedTeamId])

  // 이벤트 클릭 → 일정 상세 모달
  const handleEventClick = useCallback(
    async (info) => {
      const scheduleId = info.event.id
      const teamId = info.event.extendedProps.teamId
      try {
        const response = await apiClient.get(
          `/teams/${teamId}/schedules/${scheduleId}`
        )
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
    if (selectedTeamId && currentRange) {
      loadSchedules(selectedTeamId, currentRange)
    }
  }, [selectedTeamId, currentRange, loadSchedules])

  // 일정 삭제 완료 후 목록 새로고침
  const handleScheduleDeleted = useCallback(() => {
    setShowScheduleDetail(false)
    setSelectedSchedule(null)
    if (selectedTeamId && currentRange) {
      loadSchedules(selectedTeamId, currentRange)
    }
  }, [selectedTeamId, currentRange, loadSchedules])

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
          <div className="team-selector">
            <label htmlFor="teamSelect" className="team-selector-label">
              팀 선택
            </label>
            {teamsError ? (
              <span className="error-text">{teamsError}</span>
            ) : (
              <select
                id="teamSelect"
                className="team-select"
                value={selectedTeamId || ''}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              >
                {teams.length === 0 && (
                  <option value="">팀이 없습니다</option>
                )}
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
          </div>
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
                style={{ backgroundColor: SCHEDULE_COLORS.TEAM }}
              />
              팀 일정
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
            height="700px"
            selectable={true}
            editable={false}
            eventDisplay="block"
          />
        </div>
      </main>

      {showScheduleModal && selectedTeamId && (
        <ScheduleModal
          teamId={selectedTeamId}
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
    </div>
  )
}

export default CalendarPage
