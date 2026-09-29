-- ============================================================
-- Migration: 일정 유형 '업무'(진료실 x 업무종류) 추가 + 기존 '업무' -> '기타' 전환
-- 대상: Supabase (PostgreSQL)
-- 실행: Supabase SQL Editor 에서 수동 실행 (전체 복사 -> Run)
-- 날짜: 2026-09-29
-- ------------------------------------------------------------
-- 유형 값 변화
--   VACATION : 휴가            (변경 없음)
--   WORK     : 업무 (신규)      진료실 x 업무종류 조합, 제목은 트리거가 자동 생성
--   ETC      : 기타 (기존 WORK) 제목/설명을 사용자가 직접 입력
--
-- 멱등(idempotent) 하게 작성되어 여러 번 실행해도 안전하다.
-- ============================================================

-- ============================================================
-- 1. 하위 구분 컬럼 추가
-- ============================================================
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS work_room VARCHAR(10);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS work_type VARCHAR(20);

COMMENT ON COLUMN schedules.work_room IS '업무 일정의 진료실 (ROOM_1/ROOM_2/ROOM_3)';
COMMENT ON COLUMN schedules.work_type IS '업무 일정의 업무 종류 (FULL_DAY/AM/PM/OFF_FULL_DAY/OFF_AM/OFF_PM)';

-- ============================================================
-- 2. 기존 '업무'(WORK) 일정을 '기타'(ETC) 로 전환
--    soft delete 된 행도 함께 바꿔 유형 값이 섞이지 않게 한다.
--    (WORK 는 이제 진료실 업무 전용 값이다)
-- ============================================================
UPDATE schedules SET type = 'ETC' WHERE type = 'WORK';

-- ============================================================
-- 3. schedules.type CHECK 제약 재작성
--    기존 제약 이름을 알 수 없으므로 type 단일 컬럼에 걸린 CHECK 만 찾아 제거한다.
--    (end_at > start_at 같은 다른 CHECK 는 conkey 비교로 걸러진다)
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'type'
    WHERE t.relname = 'schedules'
      AND c.contype = 'c'
      AND c.conkey = ARRAY[a.attnum]
  LOOP
    EXECUTE format('ALTER TABLE schedules DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'dropped: schedules 의 type CHECK 제약 %', r.conname;
  END LOOP;
END $$;

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_type_check;
ALTER TABLE schedules
  ADD CONSTRAINT schedules_type_check
  CHECK (type IN ('VACATION', 'WORK', 'ETC'));

-- ============================================================
-- 4. 유형별 하위 구분 필드 일관성 제약
--    유형을 바꿔 저장할 때 이전 유형의 하위 값이 남으면
--    알림 문구/상세 화면이 엉뚱한 정보를 표시한다 (예: 업무 일정에 '조퇴 시간').
--    적용 시점 기준 기존 66행이 모두 규칙을 만족함을 확인하고 즉시 검증으로 추가한다.
-- ============================================================
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_type_fields_check;
ALTER TABLE schedules
  ADD CONSTRAINT schedules_type_fields_check
  CHECK (
    CASE type
      WHEN 'VACATION' THEN work_room IS NULL AND work_type IS NULL
      WHEN 'WORK'     THEN vacation_type IS NULL AND work_room IS NOT NULL AND work_type IS NOT NULL
      ELSE vacation_type IS NULL AND work_room IS NULL AND work_type IS NULL
    END
  );

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_work_room_check;
ALTER TABLE schedules
  ADD CONSTRAINT schedules_work_room_check
  CHECK (work_room IS NULL OR work_room IN ('ROOM_1', 'ROOM_2', 'ROOM_3'));

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_work_type_check;
ALTER TABLE schedules
  ADD CONSTRAINT schedules_work_type_check
  CHECK (work_type IS NULL OR work_type IN ('FULL_DAY', 'AM', 'PM', 'OFF_FULL_DAY', 'OFF_AM', 'OFF_PM'));

-- ============================================================
-- 5. 업무 일정 제목 자동 생성 트리거
--    휴가 제목 트리거(auto_vacation_title)는 그대로 두고 별도 함수로 추가한다.
--    두 트리거 모두 NEW.type 으로 분기하므로 서로 간섭하지 않는다.
--    제목 형식: '1진료실 오전 근무'  (프론트 buildWorkTitle() 과 동일 규칙)
-- ============================================================
CREATE OR REPLACE FUNCTION auto_work_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'WORK' THEN
    NEW.title := CONCAT(
      CASE NEW.work_room
        WHEN 'ROOM_1' THEN '1진료실'
        WHEN 'ROOM_2' THEN '2진료실'
        WHEN 'ROOM_3' THEN '3진료실'
        ELSE ''
      END,
      ' ',
      CASE NEW.work_type
        WHEN 'FULL_DAY'     THEN '종일 근무'
        WHEN 'OFF_FULL_DAY' THEN '종일 휴진'
        WHEN 'AM'           THEN '오전 근무'
        WHEN 'OFF_AM'       THEN '오전 휴진'
        WHEN 'PM'           THEN '오후 근무'
        WHEN 'OFF_PM'       THEN '오후 휴진'
        ELSE ''
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_title ON schedules;
CREATE TRIGGER trg_work_title
  BEFORE INSERT OR UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION auto_work_title();

-- ============================================================
-- 6. notification_preferences: 'ETC' 유형 허용 + 기존 설정 이관
--    기존 'WORK' 설정 행은 '기존 업무 = 기타' 에 대한 의사였으므로
--    같은 값으로 'ETC' 행을 만들고, 'WORK' 행은 신규 업무 유형용으로 남긴다.
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'schedule_type'
    WHERE t.relname = 'notification_preferences'
      AND c.contype = 'c'
      AND c.conkey = ARRAY[a.attnum]
  LOOP
    EXECUTE format('ALTER TABLE notification_preferences DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'dropped: notification_preferences 의 schedule_type CHECK 제약 %', r.conname;
  END LOOP;
END $$;

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_schedule_type_check;
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_schedule_type_check
  CHECK (schedule_type IN ('VACATION', 'WORK', 'ETC'));

INSERT INTO notification_preferences (user_id, schedule_type, action_type, enabled)
SELECT p.user_id, 'ETC', p.action_type, p.enabled
FROM notification_preferences p
WHERE p.schedule_type = 'WORK'
ON CONFLICT (user_id, schedule_type, action_type) DO NOTHING;

-- ============================================================
-- 7. schedules_with_user 뷰 재생성
--    뷰는 생성 시점에 컬럼 목록이 고정되므로(원본이 SELECT s.* 였어도)
--    컬럼을 추가하면 뷰가 자동으로 따라오지 않는다. 프론트는 이 뷰로 조회하므로
--    갱신하지 않으면 진료실/업무종류가 화면에 전달되지 않는다.
--
--    운영 뷰 정의를 그대로 옮기고 끝에 두 컬럼만 덧붙인다.
--    (CREATE OR REPLACE 는 끝에 추가만 허용 — DROP 하면 기존 권한을 잃는다)
-- ============================================================
CREATE OR REPLACE VIEW schedules_with_user AS
SELECT s.id,
    s.title,
    s.start_at,
    s.end_at,
    s.all_day,
    s.type,
    s.vacation_type,
    s.description,
    s.created_by,
    u.name AS created_by_name,
    s.created_at,
    s.deleted_at,
    s.created_by::text = auth.uid()::text AS can_edit,
    s.created_by::text = auth.uid()::text AS can_delete,
    s.work_room,
    s.work_type
   FROM schedules s
     LEFT JOIN users u ON s.created_by = u.id
  WHERE s.deleted_at IS NULL;

-- ============================================================
-- 8. 검증 쿼리 (실행 후 결과 확인용)
-- ============================================================
-- 유형별 건수
SELECT type, count(*) AS cnt FROM schedules GROUP BY type ORDER BY type;

-- 추가된 컬럼 확인
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'schedules' AND column_name IN ('work_room', 'work_type');

-- 알림 설정 유형별 건수
SELECT schedule_type, count(*) AS cnt
FROM notification_preferences GROUP BY schedule_type ORDER BY schedule_type;

-- 뷰가 신규 컬럼을 노출하는지
SELECT column_name FROM information_schema.columns
WHERE table_name = 'schedules_with_user' AND column_name IN ('work_room', 'work_type');
