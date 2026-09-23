/* ============================================================
 * 알림 문구 생성
 * ------------------------------------------------------------
 * Service Worker 가 그대로 표시할 페이로드를 만든다.
 * HTTP 핸들러(send-notification/index.ts)와 분리해 둔 이유는
 * 문구만 따로 검증/열람할 수 있게 하기 위함이다.
 * ============================================================ */

export const APP_URL = 'https://jsk-schedule-frontend.onrender.com'
/* ── 메시지 문구 ───────────────────────────────────────── */

const VACATION_LABEL: Record<string, string> = {
  FULL: '휴가(일반)',
  HALF_AM: '휴가(오전 반차)',
  HALF_PM: '휴가(오후 반차)',
  EARLY_LEAVE: '조퇴',
}

export const ACTION_LABEL: Record<string, string> = {
  CREATED: '등록',
  UPDATED: '수정',
  DELETED: '삭제',
}

const getTypeLabel = (type: string, vacationType?: string | null) =>
  type === 'VACATION' ? VACATION_LABEL[vacationType || 'FULL'] || '휴가' : '업무'

/**
 * 날짜/시각 포맷.
 *
 * schedules.start_at/end_at 은 `timestamp without time zone` 이며
 * 저장된 값 자체가 이미 한국 시간 기준 벽시계 값이다.
 * 이를 `new Date()` 로 파싱하면 런타임 타임존(Edge Function 은 UTC)을 따라
 * 해석되고, 거기에 다시 Asia/Seoul 로 포맷하면 +9시간 어긋난다.
 * (실제로 10/1 14:00 조퇴가 "오후 11:00" 으로, 당일 일정이 이틀로 표시됐다)
 *
 * 그래서 Date 를 거치지 않고 문자열에서 직접 자리를 읽는다.
 */
const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/

const parseWallClock = (ts: string) => {
  const m = ts.match(WALL_CLOCK_PATTERN)
  if (!m) return null
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  }
}

const formatDate = (ts: string) => {
  const w = parseWallClock(ts)
  if (!w) return ts
  return `${w.year}. ${w.month}. ${w.day}.`
}

const formatDateRange = (start: string, end: string) => {
  const s = formatDate(start)
  const e = formatDate(end)
  return s === e ? s : `${s} ~ ${e}`
}

const formatTime = (ts: string) => {
  const w = parseWallClock(ts)
  if (!w) return ts
  const meridiem = w.hour < 12 ? '오전' : '오후'
  const hour12 = w.hour % 12 === 0 ? 12 : w.hour % 12
  return `${meridiem} ${String(hour12).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`
}

export interface ScheduleRow {
  id: number
  title: string
  type: string
  vacation_type: string | null
  start_at: string
  end_at: string
  all_day: boolean
}

export interface OldData {
  type?: string
  vacationType?: string | null
  startAt?: string
  endAt?: string
}

/** Service Worker가 그대로 표시할 알림 페이로드를 만든다 */
export function buildPayload(
  schedule: ScheduleRow,
  actionType: string,
  actorName: string,
  oldData?: OldData,
) {
  const actionLabel = ACTION_LABEL[actionType] || '변경'
  const typeLabel = getTypeLabel(schedule.type, schedule.vacation_type)
  const newDateStr = formatDateRange(schedule.start_at, schedule.end_at)

  const lines: string[] = [schedule.title]

  if (actionType === 'UPDATED' && oldData) {
    const oldTypeLabel = getTypeLabel(oldData.type || schedule.type, oldData.vacationType)
    const oldDateStr =
      oldData.startAt && oldData.endAt ? formatDateRange(oldData.startAt, oldData.endAt) : null

    const changes: string[] = []
    if (oldTypeLabel !== typeLabel) changes.push(`${oldTypeLabel} → ${typeLabel}`)
    if (oldDateStr && oldDateStr !== newDateStr) changes.push(`${oldDateStr} → ${newDateStr}`)

    lines.push(changes.length > 0 ? changes.join('\n') : `${typeLabel} · ${newDateStr}`)
  } else if (actionType === 'DELETED') {
    lines.push(`${typeLabel} · ${newDateStr} 삭제됨`)
  } else {
    let detail = `${typeLabel} · ${newDateStr}`
    if (schedule.vacation_type === 'EARLY_LEAVE' && schedule.end_at) {
      detail += ` ${formatTime(schedule.end_at)} 조퇴`
    } else if (!schedule.all_day) {
      detail += ` ${formatTime(schedule.start_at)} ~ ${formatTime(schedule.end_at)}`
    } else {
      detail += ' 하루 종일'
    }
    lines.push(detail)
  }

  // 알림 클릭 시 해당 일정이 있는 달로 이동.
  // 저장값이 이미 'YYYY-MM-DD...' 형식이라 Date 변환 없이 앞부분을 그대로 쓴다
  // (Date 로 변환하면 타임존에 따라 월이 어긋날 수 있다)
  const month = schedule.start_at.slice(0, 7)

  return {
    title: `일정 ${actionLabel} · ${actorName}`,
    body: lines.join('\n'),
    url: `${APP_URL}/?month=${month}`,
    // 같은 일정의 연속 변경은 하나로 합쳐 표시
    tag: `schedule-${schedule.id}`,
  }
}
