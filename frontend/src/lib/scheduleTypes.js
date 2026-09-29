/* ============================================================
 * 일정 유형 어휘 (단일 소스)
 * ------------------------------------------------------------
 * 모달 / 상세 / 캘린더가 같은 값과 라벨을 쓰도록 여기서만 정의한다.
 * Edge Function(_shared/notification-message.ts)은 Deno 런타임이라
 * 이 파일을 import 할 수 없으므로 같은 어휘를 따로 갖고 있다.
 * 값을 바꿀 때는 아래 3곳을 함께 수정해야 한다.
 *   1) 이 파일
 *   2) supabase/functions/_shared/notification-message.ts
 *   3) docs/migrations/add_work_schedule_type.sql (제목 트리거 / CHECK 제약)
 * ============================================================ */

/** 유형 선택 순서: 휴가 -> 업무 -> 기타 */
export const SCHEDULE_TYPES = [
  { value: 'VACATION', label: '휴가' },
  { value: 'WORK', label: '업무' },
  { value: 'ETC', label: '기타' },
]

export const VACATION_TYPES = [
  { value: 'FULL', label: '일반' },
  { value: 'HALF_AM', label: '오전 반차' },
  { value: 'HALF_PM', label: '오후 반차' },
  { value: 'EARLY_LEAVE', label: '조퇴' },
]

export const WORK_ROOMS = [
  { value: 'ROOM_1', label: '1진료실' },
  { value: 'ROOM_2', label: '2진료실' },
  { value: 'ROOM_3', label: '3진료실' },
]

/**
 * 선택 박스가 한 줄에 2개씩 배치되므로, 근무/휴진을 번갈아 두어
 * 왼쪽 열은 근무 · 오른쪽 열은 휴진으로 세로 그룹핑되게 한다.
 *   종일 근무 | 종일 휴진
 *   오전 근무 | 오전 휴진
 *   오후 근무 | 오후 휴진
 */
export const WORK_TYPES = [
  { value: 'FULL_DAY', label: '종일 근무' },
  { value: 'OFF_FULL_DAY', label: '종일 휴진' },
  { value: 'AM', label: '오전 근무' },
  { value: 'OFF_AM', label: '오전 휴진' },
  { value: 'PM', label: '오후 근무' },
  { value: 'OFF_PM', label: '오후 휴진' },
]

const toLabelMap = (options) =>
  options.reduce((acc, o) => {
    acc[o.value] = o.label
    return acc
  }, {})

export const SCHEDULE_TYPE_LABEL = toLabelMap(SCHEDULE_TYPES)
export const VACATION_TYPE_LABEL = toLabelMap(VACATION_TYPES)
export const WORK_ROOM_LABEL = toLabelMap(WORK_ROOMS)
export const WORK_TYPE_LABEL = toLabelMap(WORK_TYPES)

export const DEFAULT_WORK_ROOM = WORK_ROOMS[0].value
export const DEFAULT_WORK_TYPE = WORK_TYPES[0].value

/**
 * 업무 일정 제목. DB 트리거 auto_work_title() 이 저장 시 같은 규칙으로 덮어쓰므로
 * 트리거가 최종 권한이며, 이 함수는 마이그레이션 적용 전에도 제목이 비지 않게 하는 보조값이다.
 */
export const buildWorkTitle = (workRoom, workType) =>
  `${WORK_ROOM_LABEL[workRoom] || ''} ${WORK_TYPE_LABEL[workType] || ''}`.trim()
