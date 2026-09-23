-- ============================================================
-- 웹 푸시 구독 테이블 추가
-- 실행 환경: Supabase SQL Editor
-- 날짜: 2026-09-23
-- ============================================================
-- 웹 푸시 권한/구독은 (사용자 x 기기 x 브라우저)마다 별도로 생성되므로
-- users 테이블의 컬럼이 아니라 1:N 테이블로 관리한다.
-- 예) 박준호가 아이폰 + 회사 PC + 집 노트북에서 사용 -> 구독 3건
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 푸시 서비스(FCM/Mozilla/APNs)가 발급한 구독 고유 URL
    endpoint     TEXT NOT NULL UNIQUE,
    -- RFC 8291 페이로드 암호화용 키 (base64url)
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    -- 기기 식별용 (설정 화면에서 "iPhone Safari" 등으로 표시)
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON push_subscriptions(user_id);

-- ============================================================
-- RLS: 기존 테이블과 동일한 패턴 적용
-- ============================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_read_own" ON push_subscriptions;
CREATE POLICY "push_subs_read_own" ON push_subscriptions
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions;
CREATE POLICY "push_subs_delete_own" ON push_subscriptions
  FOR DELETE USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- INSERT/UPDATE는 save-push-subscription Edge Function(service_role)이 담당
DROP POLICY IF EXISTS "push_subs_service_role_all" ON push_subscriptions;
CREATE POLICY "push_subs_service_role_all" ON push_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- notification_preferences: 채널 구분 없이 재사용
-- 기존 (user_id, schedule_type, action_type, enabled) 구조 그대로 사용한다.
-- 행이 없으면 기본값 TRUE로 간주 (send-notification 로직과 동일)
-- ============================================================

-- 완료. Supabase Dashboard에서 RLS 정책 확인 필요.

-- ============================================================
-- notifications.channel 에 'WEB_PUSH' 허용
-- ------------------------------------------------------------
-- 기존 스키마는 채널이 카카오 전용('KAKAO')으로 제한돼 있다.
-- 컬럼 타입이 네이티브 ENUM인지 VARCHAR+CHECK인지 환경마다 다를 수 있어
-- 두 경우를 모두 처리한다.
--
-- 주의: 이 블록이 실패하더라도 푸시 발송 자체는 동작한다.
--       send-notification 은 알림 기록 INSERT 실패를 치명적으로 취급하지 않는다.
-- ============================================================
DO $$
DECLARE
  col_type TEXT;
  con_name TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO col_type
    FROM pg_attribute a
   WHERE a.attrelid = 'notifications'::regclass
     AND a.attname  = 'channel'
     AND a.attnum   > 0;

  IF col_type IS NULL THEN
    RAISE NOTICE 'notifications.channel 컬럼이 없습니다. 건너뜁니다.';
    RETURN;
  END IF;

  -- (a) 네이티브 ENUM 타입인 경우: 값만 추가
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = col_type AND t.typtype = 'e') THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_type, 'WEB_PUSH');
    RAISE NOTICE 'ENUM 타입 %에 WEB_PUSH 추가됨', col_type;
    RETURN;
  END IF;

  -- (b) VARCHAR + CHECK 인 경우: 제약 교체
  SELECT conname
    INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'notifications'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%channel%'
   LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', con_name);
    RAISE NOTICE '기존 제약 % 제거됨', con_name;
  END IF;

  ALTER TABLE notifications
    ADD CONSTRAINT notifications_channel_check
    CHECK (channel IN ('KAKAO', 'WEB_PUSH'));
  RAISE NOTICE 'notifications_channel_check 재생성 완료';
END $$;

-- ============================================================
-- notifications.created_at 에 DEFAULT NOW() 추가 (2026-09-23 추가)
-- ------------------------------------------------------------
-- 이 컬럼은 NOT NULL 이지만 DEFAULT 가 없어, INSERT 시 값을 명시하지 않으면
-- 23502(not-null violation)로 실패한다.
-- 실제로 알림 기록이 한 건도 쌓이지 않고 있었다(카카오 구현 시절부터 동일).
--
-- send-notification 은 created_at 을 명시적으로 넣도록 수정했으나,
-- 같은 실수가 반복되지 않도록 DB 차원에서도 기본값을 둔다.
--
-- 참고: users.created_at / users.updated_at 도 같은 구조다.
--       (kakao-auth 에서 값을 명시해 우회 중)
-- ============================================================
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT NOW();
