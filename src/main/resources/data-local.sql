-- 테스트 계정 생성
-- 비밀번호는 모두 "1234"로 BCrypt 인코딩됨

-- 1. admin 계정 (ADMIN 등급)
INSERT INTO users (username, password, email, name, role, created_at, updated_at)
VALUES ('admin', '$2a$10$slYQmyNdGzin7olVN3/9m.vccHSvNGUQ37sQh8OrIeeEffkm69FSm', 'admin@example.com', '관리자', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. siljang 계정 (MANAGER 등급)
INSERT INTO users (username, password, email, name, role, created_at, updated_at)
VALUES ('siljang', '$2a$10$slYQmyNdGzin7olVN3/9m.vccHSvNGUQ37sQh8OrIeeEffkm69FSm', 'siljang@example.com', '실장', 'MANAGER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. user 계정 (MEMBER 등급)
INSERT INTO users (username, password, email, name, role, created_at, updated_at)
VALUES ('user', '$2a$10$slYQmyNdGzin7olVN3/9m.vccHSvNGUQ37sQh8OrIeeEffkm69FSm', 'user@example.com', '사용자', 'MEMBER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
