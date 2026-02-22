-- Migration: notification_preferences 테이블 생성
-- 대상: Supabase (PostgreSQL)
-- 실행: Supabase SQL Editor에서 수동 실행

CREATE TABLE IF NOT EXISTS notification_preferences (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_type VARCHAR(10) NOT NULL CHECK (schedule_type IN ('VACATION', 'WORK')),
    action_type   VARCHAR(10) NOT NULL CHECK (action_type IN ('CREATED', 'UPDATED', 'DELETED')),
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, schedule_type, action_type)
);

-- 인덱스: userId 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
    ON notification_preferences (user_id);

-- 기존 사용자 대상 기본 설정 삽입 (신규 가입자는 AuthService에서 자동 생성)
INSERT INTO notification_preferences (user_id, schedule_type, action_type, enabled)
SELECT u.id, st.schedule_type, at.action_type, TRUE
FROM users u
CROSS JOIN (VALUES ('VACATION'), ('WORK')) AS st(schedule_type)
CROSS JOIN (VALUES ('CREATED'), ('UPDATED'), ('DELETED')) AS at(action_type)
ON CONFLICT (user_id, schedule_type, action_type) DO NOTHING;
