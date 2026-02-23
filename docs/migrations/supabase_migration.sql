-- ============================================================
-- JSK Schedule Manager: Supabase 중심 구조 전환 마이그레이션
-- 실행 환경: Supabase SQL Editor
-- 날짜: 2026-02-23
-- ============================================================

-- ============================================================
-- 1. users 테이블에 Supabase Auth 연동 컬럼 추가
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- ============================================================
-- 2. RLS (Row Level Security) 활성화 및 정책 생성
-- ============================================================

-- --- users ---
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_id = auth.uid());

-- Edge Function (service_role)이 사용자 생성/수정 가능하도록
CREATE POLICY "users_service_role_all" ON users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- --- schedules ---
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 조회 가능 (soft delete 필터링)
CREATE POLICY "schedules_read_all" ON schedules
  FOR SELECT USING (deleted_at IS NULL);

-- 인증 사용자 생성 가능
CREATE POLICY "schedules_insert_auth" ON schedules
  FOR INSERT WITH CHECK (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- 본인 일정만 수정 가능
CREATE POLICY "schedules_update_own" ON schedules
  FOR UPDATE USING (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- service_role 전체 접근 (Edge Functions용)
CREATE POLICY "schedules_service_role_all" ON schedules
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- --- notifications ---
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "notifications_service_role_all" ON notifications
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- --- notification_preferences ---
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_read_own" ON notification_preferences
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "prefs_update_own" ON notification_preferences
  FOR UPDATE USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "prefs_service_role_all" ON notification_preferences
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- --- refresh_tokens (더 이상 사용하지 않음, Supabase Auth가 관리) ---
-- 기존 테이블은 유지하되 RLS로 차단
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = 모든 접근 차단 (service_role 제외)

-- ============================================================
-- 3. VACATION 제목 자동 생성 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION auto_vacation_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'VACATION' THEN
    NEW.title := '[' || (SELECT name FROM users WHERE id = NEW.created_by) || '] ' ||
                 CASE
                   WHEN NEW.title IS NOT NULL AND NEW.title != '' THEN NEW.title
                   ELSE '휴가'
                 END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS trg_vacation_title ON schedules;

CREATE TRIGGER trg_vacation_title
  BEFORE INSERT ON schedules
  FOR EACH ROW EXECUTE FUNCTION auto_vacation_title();

-- ============================================================
-- 4. 일정 CRUD 시 created_by_name 조회를 위한 뷰 생성
-- ============================================================
CREATE OR REPLACE VIEW schedules_with_user AS
SELECT
  s.*,
  u.name AS created_by_name,
  CASE
    WHEN s.created_by = (SELECT id FROM users WHERE auth_id = auth.uid()) THEN true
    ELSE false
  END AS can_edit,
  CASE
    WHEN s.created_by = (SELECT id FROM users WHERE auth_id = auth.uid()) THEN true
    ELSE false
  END AS can_delete
FROM schedules s
LEFT JOIN users u ON s.created_by = u.id
WHERE s.deleted_at IS NULL;

-- ============================================================
-- 5. 기존 username/password 컬럼 (카카오 전용이므로 nullable 유지)
-- ============================================================
-- 변경 없음 - 이미 nullable

-- ============================================================
-- 완료 메시지
-- ============================================================
-- 마이그레이션 완료. Supabase Dashboard에서 RLS 정책 확인 필요.
