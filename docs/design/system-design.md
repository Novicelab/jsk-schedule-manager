# JSK 일정 관리 서비스 - 전체 시스템 설계서

> 작성일: 2026-02-19
> 작성자: designer 에이전트
> 상태: 초안

---

## 1. 시스템 아키텍처

### 1.1 전체 시스템 구조도

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              React SPA (프론트엔드)                         │  │
│  │  - FullCalendar (캘린더 뷰)                                │  │
│  │  - Axios (HTTP 클라이언트)                                  │  │
│  │  - JWT 토큰 관리 (LocalStorage / Cookie)                   │  │
│  └────────────────────────┬──────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTPS (REST API)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SPRING BOOT APPLICATION                       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │  Security    │  │  JWT Filter │  │  CORS Filter         │   │
│  │  Config      │  │             │  │                      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
│         └────────────────┼────────────────────┘               │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Controller Layer                        │   │
│  │  AuthController│TeamController│ScheduleController│...   │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                          │   │
│  │  AuthService │TeamService │ScheduleService│NotifService │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Repository Layer                        │   │
│  │  UserRepo │TeamRepo │ScheduleRepo │NotificationRepo    │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                    │
│  ┌────────────────────────┼────────────────────────────────┐   │
│  │           Async Event / Message Queue                    │   │
│  │  ┌──────────────────────────────────────────┐           │   │
│  │  │  Spring @Async + ApplicationEventPublisher│           │   │
│  │  │  (알림 비동기 처리)                          │           │   │
│  │  └──────────────────────────────────────────┘           │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────┬──────────────────┘
                │                             │
                ▼                             ▼
┌──────────────────────┐       ┌──────────────────────────────┐
│ Supabase(PostgreSQL) │       │    Kakao API (외부 서비스)      │
│                      │       │                              │
│  - users             │       │  ┌────────────────────────┐  │
│  - teams             │       │  │ OAuth 2.0 (인증/인가)    │  │
│  - team_members      │       │  │ POST /oauth/token      │  │
│  - schedules         │       │  └────────────────────────┘  │
│  - team_invitations  │       │  ┌────────────────────────┐  │
│  - notifications     │       │  │ 알림톡 API (알림 발송)    │  │
│  - refresh_tokens    │       │  │ POST /v2/api/talk/memo  │  │
│                      │       │  └────────────────────────┘  │
└──────────────────────┘       │  ┌────────────────────────┐  │
                               │  │ 메시지 API (팀 초대)     │  │
                               │  │ POST /v1/api/talk/...   │  │
                               │  └────────────────────────┘  │
                               └──────────────────────────────┘
```

**기술 스택 확정:**

| 항목 | 선택 | 선택 이유 |
|------|------|-----------|
| DB | **Supabase (PostgreSQL)** | BaaS, PostgreSQL 기반 클라우드 관리형 DB, 별도 DB 서버 운영 불필요, PgBouncer 커넥션 풀링 |
| 빌드 도구 | **Gradle** | Spring Boot 기본 권장, 빌드 속도 우수 |
| 프론트엔드 | **React + Vite** | 캘린더 SPA UX, FullCalendar React 래퍼, JWT 인증 친화적, 빠른 빌드 |
| 스타일링 | **Tailwind CSS** | 유틸리티 기반 CSS, 빠른 프로토타이핑, 일관된 디자인 시스템 |
| 배포 | **Render** | 클라우드 앱 호스팅 플랫폼, GitHub 연동 자동 배포, 무료 Tier 지원 |
| 배포 구성 | **Docker (Backend) + Static Site (Frontend)** | Backend: Spring Boot Docker, Frontend: Vite 빌드 정적 파일 (Tailwind 통합) |
| 배포 지역 | **Singapore** | 아시아 지역 최적 성능, 낮은 레이턴시 |
| 소스관리/CI·CD | **GitHub** | 코드 버전관리 및 Render 자동 배포 트리거 (push 시 자동 배포) |
| 배포 URL (Live) | **Backend**: https://jsk-schedule-backend.onrender.com<br/>**Frontend**: https://jsk-schedule-frontend.onrender.com | 프로덕션 배포 완료 ✅ |

### 1.2 레이어드 아키텍처 상세

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (Controller, DTO, 요청 검증)                                 │
│  - HTTP 요청 수신, 응답 반환                                   │
│  - @Valid를 통한 입력 검증                                     │
│  - 인증/인가 어노테이션 처리                                    │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  (Service, Facade)                                          │
│  - 비즈니스 로직 조합 및 트랜잭션 관리                            │
│  - 도메인 객체 조합, 이벤트 발행                                 │
│  - 외부 API 연동 조율                                         │
├─────────────────────────────────────────────────────────────┤
│                     Domain Layer                             │
│  (Entity, Enum, Domain Service)                             │
│  - 핵심 비즈니스 규칙 캡슐화                                    │
│  - 엔티티 상태 변경 로직                                       │
│  - 도메인 이벤트 정의                                          │
├─────────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                        │
│  (Repository, External API Client, Config)                  │
│  - JPA Repository (DB 접근)                                  │
│  - Kakao API Client (OAuth, 알림톡)                           │
│  - Spring Security, JWT 설정                                 │
└─────────────────────────────────────────────────────────────┘
```

**레이어 간 의존성 규칙:**
- Controller → Service → Repository (단방향 의존)
- 상위 레이어가 하위 레이어를 호출하며, 역방향 의존은 금지
- Service 레이어 간 직접 호출은 허용하되, 순환 의존 발생 시 이벤트 기반으로 분리

### 1.3 카카오 OAuth 인증 흐름 (시퀀스 다이어그램)

```
  Browser            React App          Spring Boot           Kakao API          Supabase
    │                   │                   │                    │                 │
    │  1. 로그인 버튼 클릭  │                   │                    │                 │
    ├──────────────────>│                   │                    │                 │
    │                   │                   │                    │                 │
    │  2. 카카오 인증 페이지로 리다이렉트            │                    │                 │
    │<──────────────────┤                   │                    │                 │
    │                   │                   │                    │                 │
    │  3. 카카오 로그인 + 동의                  │                    │                 │
    ├───────────────────────────────────────────────────────────>│                 │
    │                   │                   │                    │                 │
    │  4. Authorization Code 반환 (redirect_uri로)               │                 │
    │<──────────────────────────────────────────────────────────┤                 │
    │                   │                   │                    │                 │
    │  5. Authorization Code 전달             │                    │                 │
    ├──────────────────>│                   │                    │                 │
    │                   │  6. POST /api/auth/kakao/callback      │                 │
    │                   │   {code: "..."}   │                    │                 │
    │                   ├──────────────────>│                    │                 │
    │                   │                   │                    │                 │
    │                   │                   │  7. POST /oauth/token                │
    │                   │                   │  (code → kakao access token)         │
    │                   │                   ├───────────────────>│                 │
    │                   │                   │                    │                 │
    │                   │                   │  8. Kakao Access Token 반환           │
    │                   │                   │<───────────────────┤                 │
    │                   │                   │                    │                 │
    │                   │                   │  9. GET /v2/user/me                  │
    │                   │                   │  (사용자 정보 조회)    │                 │
    │                   │                   ├───────────────────>│                 │
    │                   │                   │                    │                 │
    │                   │                   │  10. 사용자 정보 반환  │                 │
    │                   │                   │<───────────────────┤                 │
    │                   │                   │                    │                 │
    │                   │                   │  11. User 조회/생성                    │
    │                   │                   ├─────────────────────────────────────>│
    │                   │                   │                                      │
    │                   │                   │  12. User 정보 반환                    │
    │                   │                   │<─────────────────────────────────────┤
    │                   │                   │                    │                 │
    │                   │                   │  13. JWT (Access + Refresh) 생성       │
    │                   │                   │  14. Refresh Token DB 저장            │
    │                   │                   ├─────────────────────────────────────>│
    │                   │                   │                    │                 │
    │                   │  15. JWT 토큰 반환   │                    │                 │
    │                   │  {accessToken, refreshToken}           │                 │
    │                   │<──────────────────┤                    │                 │
    │                   │                   │                    │                 │
    │  16. 토큰 저장 + 메인 페이지 이동           │                    │                 │
    │<──────────────────┤                   │                    │                 │
```

**토큰 재발급 흐름:**

```
  React App              Spring Boot              Supabase
    │                        │                      │
    │  1. API 요청 (만료된 Access Token)              │
    ├───────────────────────>│                      │
    │                        │                      │
    │  2. 401 Unauthorized   │                      │
    │<───────────────────────┤                      │
    │                        │                      │
    │  3. POST /api/auth/reissue                    │
    │  {refreshToken: "..."}  │                      │
    ├───────────────────────>│                      │
    │                        │  4. Refresh Token 검증 │
    │                        ├─────────────────────>│
    │                        │  5. 유효성 확인         │
    │                        │<─────────────────────┤
    │                        │                      │
    │                        │  6. 새 Access Token 생성│
    │                        │  7. Refresh Token 갱신 (Rotation)
    │                        ├─────────────────────>│
    │                        │                      │
    │  8. 새 토큰 반환         │                      │
    │  {accessToken, refreshToken}                   │
    │<───────────────────────┤                      │
    │                        │                      │
    │  9. 원래 API 재요청 (새 Access Token)            │
    ├───────────────────────>│                      │
```

### 1.4 카카오톡 알림 발송 흐름 (비동기 처리)

```
  Controller          Service           EventPublisher      AsyncListener       KakaoClient       Supabase
    │                   │                    │                   │                  │               │
    │  1. 일정 등록 요청  │                    │                   │                  │               │
    ├──────────────────>│                    │                   │                  │               │
    │                   │  2. 일정 저장 (트랜잭션 내)                 │                  │               │
    │                   ├────────────────────────────────────────────────────────────────────────>│
    │                   │                    │                   │                  │               │
    │                   │  3. ScheduleCreatedEvent 발행           │                  │               │
    │                   ├───────────────────>│                   │                  │               │
    │                   │                    │                   │                  │               │
    │  4. 201 Created   │                    │                   │                  │               │
    │<──────────────────┤                    │                   │                  │               │
    │  (응답 즉시 반환,    │                    │                   │                  │               │
    │   알림은 비동기)     │                    │                   │                  │               │
    │                   │                    │  5. 이벤트 전달      │                  │               │
    │                   │                    │  (@Async)         │                  │               │
    │                   │                    ├──────────────────>│                  │               │
    │                   │                    │                   │                  │               │
    │                   │                    │                   │  6. 팀원 목록 조회   │               │
    │                   │                    │                   ├──────────────────────────────>│
    │                   │                    │                   │  7. 팀원 목록 반환   │               │
    │                   │                    │                   │<─────────────────────────────┤
    │                   │                    │                   │                  │               │
    │                   │                    │                   │  8. 카카오 알림톡    │               │
    │                   │                    │                   │     API 호출       │               │
    │                   │                    │                   ├─────────────────>│               │
    │                   │                    │                   │  (팀원 수만큼)      │               │
    │                   │                    │                   │                  │               │
    │                   │                    │                   │  9. 발송 결과       │               │
    │                   │                    │                   │<─────────────────┤               │
    │                   │                    │                   │                  │               │
    │                   │                    │                   │  10. 알림 이력 저장  │               │
    │                   │                    │                   ├──────────────────────────────>│
    │                   │                    │                   │                  │               │
    │                   │                    │                   │  (실패 시 최대 3회 재시도)            │
```

**비동기 처리 방식:**
- Spring `@Async` + `ApplicationEventPublisher` 조합
- `@TransactionalEventListener(phase = AFTER_COMMIT)` — 트랜잭션 커밋 후에만 이벤트 발행 보장
- 알림 발송 실패 시 최대 3회 재시도, 최종 실패 시 `FAILED` 상태로 DB 기록
- 알림 발송 실패는 일정 CRUD 트랜잭션에 영향 없음 (비동기 분리)

---

## 2. ERD (Entity-Relationship Diagram)

### 2.1 ER 다이어그램

```
┌──────────────────────┐       ┌───────────────────────────────┐
│       users          │       │         teams                 │
├──────────────────────┤       ├───────────────────────────────┤
│ PK  id          BIGINT│       │ PK  id             BIGINT    │
│     kakao_id    BIGINT│       │     name           VARCHAR(50)│
│     email    VARCHAR  │       │     description    VARCHAR    │
│     name     VARCHAR  │       │     created_by     BIGINT ──FK┤──┐
│     profile_image_url │       │     created_at     TIMESTAMPTZ   │  │
│     kakao_access_token│       │     updated_at     TIMESTAMPTZ   │  │
│     created_at TIMESTAMPTZ│       └──────────┬────────────────────┘  │
│     updated_at TIMESTAMPTZ│                  │                       │
└──────┬───────────────┘                  │ 1                     │
       │                                  │                       │
       │ 1                                │                       │
       │         ┌────────────────────────┤                       │
       │         │                        │                       │
       │    N    ▼    N                   │                       │
       │  ┌──────────────────────────┐    │                       │
       ├──┤     team_members         │    │                       │
       │  ├──────────────────────────┤    │                       │
       │  │ PK  id          BIGINT   │    │                       │
       │  │ FK  team_id     BIGINT ──┼────┘                       │
       │  │ FK  user_id     BIGINT ──┼────────────────────────────┘
       │  │     role         ENUM    │  (ADMIN, MEMBER)
       │  │     joined_at   TIMESTAMPTZ │
       │  │ UQ  (team_id, user_id)   │
       │  └──────────────────────────┘
       │
       │  ┌──────────────────────────────────────┐
       │  │        team_invitations              │
       │  ├──────────────────────────────────────┤
       │  │ PK  id               BIGINT          │
       │  │ FK  team_id          BIGINT ─────────┼──> teams.id
       │  │ FK  inviter_id       BIGINT ─────────┼──> users.id
       │  │ FK  invitee_id       BIGINT (NULL) ──┼──> users.id
       │  │     invitee_kakao_id BIGINT          │
       │  │     token            VARCHAR(255) UQ  │
       │  │     status           ENUM            │  (PENDING, ACCEPTED, REJECTED, EXPIRED)
       │  │     expires_at       TIMESTAMPTZ        │
       │  │     created_at       TIMESTAMPTZ        │
       │  │     responded_at     TIMESTAMPTZ (NULL)  │
       │  └──────────────────────────────────────┘
       │
       │         ┌────────────────────────────────────────┐
       │         │          schedules                     │
       │         ├────────────────────────────────────────┤
       │         │ PK  id            BIGINT               │
       │         │     title         VARCHAR(100)          │
       │         │     description   TEXT (NULL)            │
       │         │     type          ENUM                  │  (VACATION, TEAM)
       │         │     start_at      TIMESTAMPTZ              │
       │         │     end_at        TIMESTAMPTZ              │
       │         │     all_day       BOOLEAN DEFAULT FALSE  │
       │         │ FK  team_id       BIGINT ───────────────┼──> teams.id
       │         │ FK  created_by    BIGINT ───────────────┼──> users.id
       │         │     created_at    TIMESTAMPTZ              │
       │         │     updated_at    TIMESTAMPTZ              │
       │         │     deleted_at    TIMESTAMPTZ (NULL)        │  ← 소프트 딜리트
       │         └────────────┬───────────────────────────┘
       │                      │
       │                      │ 1
       │                      │
       │  N                   │ N
       │  ┌───────────────────┴──────────────────────────┐
       ├──┤          notifications                       │
       │  ├──────────────────────────────────────────────┤
       │  │ PK  id             BIGINT                    │
       │  │ FK  schedule_id    BIGINT (NULL) ────────────┼──> schedules.id
       │  │ FK  user_id        BIGINT ───────────────────┼──> users.id
       │  │     type           ENUM                      │
       │  │     channel        ENUM                      │  (KAKAO)
       │  │     status         ENUM                      │  (PENDING, SUCCESS, FAILED)
       │  │     message        TEXT                       │
       │  │     sent_at        TIMESTAMPTZ (NULL)            │
       │  │     created_at     TIMESTAMPTZ                  │
       │  └──────────────────────────────────────────────┘
       │
       │  ┌──────────────────────────────────────┐
       └──┤       refresh_tokens                 │
          ├──────────────────────────────────────┤
          │ PK  id             BIGINT            │
          │ FK  user_id        BIGINT ───────────┼──> users.id
          │     token          VARCHAR(512) UQ    │
          │     expires_at     TIMESTAMPTZ          │
          │     created_at     TIMESTAMPTZ          │
          └──────────────────────────────────────┘
```

### 2.2 테이블 상세 정의

#### users

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 사용자 고유 식별자 |
| kakao_id | BIGINT | NOT NULL, UNIQUE | 카카오 계정 고유 ID |
| email | VARCHAR(255) | NULL | 카카오에서 제공한 이메일 (선택 동의) |
| name | VARCHAR(50) | NOT NULL | 카카오 닉네임 또는 사용자 설정 이름 |
| profile_image_url | VARCHAR(512) | NULL | 카카오 프로필 이미지 URL |
| kakao_access_token | VARCHAR(512) | NULL | 카카오 API 호출용 토큰 (알림톡 발송에 사용) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 가입 일시 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() (트리거로 자동 갱신) | 정보 수정 일시 |

> **설계 결정**: 카카오 OAuth 전용 인증이므로 password 컬럼 불필요. `kakao_access_token`을 저장하여 알림톡 API 호출에 활용.

#### teams

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 팀 고유 식별자 |
| name | VARCHAR(50) | NOT NULL | 팀 이름 (중복 허용) |
| description | VARCHAR(500) | NULL | 팀 설명 |
| created_by | BIGINT | NOT NULL, FK(users.id) | 팀 생성자 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() (트리거로 자동 갱신) | 수정 일시 |

#### team_members

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 고유 식별자 |
| team_id | BIGINT | NOT NULL, FK(teams.id) | 팀 ID |
| user_id | BIGINT | NOT NULL, FK(users.id) | 사용자 ID |
| role | ENUM('ADMIN','MEMBER') | NOT NULL, DEFAULT 'MEMBER' | 팀 내 역할 |
| joined_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 팀 가입 일시 |

- UNIQUE 제약: `(team_id, user_id)`

#### schedules

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 일정 고유 식별자 |
| title | VARCHAR(100) | NOT NULL | 일정 제목 |
| description | TEXT | NULL | 일정 상세 설명 |
| type | ENUM('VACATION','TEAM') | NOT NULL | 일정 유형 |
| start_at | TIMESTAMPTZ | NOT NULL | 시작 일시 |
| end_at | TIMESTAMPTZ | NOT NULL | 종료 일시 |
| all_day | BOOLEAN | NOT NULL, DEFAULT FALSE | 종일 일정 여부 |
| team_id | BIGINT | NOT NULL, FK(teams.id) | 소속 팀 ID |
| created_by | BIGINT | NOT NULL, FK(users.id) | 등록자 ID |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 등록 일시 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() (트리거로 자동 갱신) | 수정 일시 |
| deleted_at | TIMESTAMPTZ | NULL | 소프트 딜리트 일시 |

- CHECK 제약: `end_at > start_at`
- INDEX: `(team_id, start_at, end_at)` — 팀별 기간 조회 최적화
- INDEX: `(deleted_at)` — 소프트 딜리트 필터링

#### team_invitations

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 고유 식별자 |
| team_id | BIGINT | NOT NULL, FK(teams.id) | 초대 대상 팀 |
| inviter_id | BIGINT | NOT NULL, FK(users.id) | 초대자 (Admin) |
| invitee_id | BIGINT | NULL, FK(users.id) | 초대 대상자 (가입 사용자인 경우) |
| invitee_kakao_id | BIGINT | NOT NULL | 초대 대상의 카카오 ID |
| token | VARCHAR(255) | NOT NULL, UNIQUE | 초대 링크용 고유 토큰 (UUID) |
| status | ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED') | NOT NULL, DEFAULT 'PENDING' | 초대 상태 |
| expires_at | TIMESTAMPTZ | NOT NULL | 초대 만료 일시 (생성 + 7일) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 초대 생성 일시 |
| responded_at | TIMESTAMPTZ | NULL | 수락/거절 응답 일시 |

#### notifications

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 고유 식별자 |
| schedule_id | BIGINT | NULL, FK(schedules.id) | 관련 일정 ID (팀 초대/추방 알림은 NULL) |
| user_id | BIGINT | NOT NULL, FK(users.id) | 알림 수신자 |
| type | ENUM('SCHEDULE_CREATED','SCHEDULE_UPDATED','SCHEDULE_DELETED','TEAM_INVITED','TEAM_EXPELLED') | NOT NULL | 알림 유형 |
| channel | ENUM('KAKAO') | NOT NULL, DEFAULT 'KAKAO' | 알림 채널 |
| status | ENUM('PENDING','SUCCESS','FAILED') | NOT NULL, DEFAULT 'PENDING' | 발송 상태 |
| message | TEXT | NOT NULL | 알림 메시지 내용 |
| sent_at | TIMESTAMPTZ | NULL | 실제 발송 일시 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 생성 일시 |

#### refresh_tokens

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY | 고유 식별자 |
| user_id | BIGINT | NOT NULL, FK(users.id) | 토큰 소유자 |
| token | VARCHAR(512) | NOT NULL, UNIQUE | Refresh Token 값 |
| expires_at | TIMESTAMPTZ | NOT NULL | 만료 일시 (생성 시점 + 30일) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 생성 일시 |

### 2.3 테이블 관계 요약

```
users  1 ─── N  team_members  N ─── 1  teams
users  1 ─── N  schedules     N ─── 1  teams
users  1 ─── N  notifications N ─── 1  schedules (nullable)
users  1 ─── N  refresh_tokens
users  1 ─── N  team_invitations (as inviter)
users  1 ─── N  team_invitations (as invitee, nullable)
teams  1 ─── N  team_invitations
```

---

## 3. 패키지 구조

```
src/
├── main/
│   ├── java/
│   │   └── com/
│   │       └── jsk/
│   │           └── schedule/
│   │               │
│   │               ├── JskScheduleApplication.java
│   │               │
│   │               ├── global/                               ── 전역 공통 모듈
│   │               │   ├── config/
│   │               │   │   ├── SecurityConfig.java
│   │               │   │   ├── JwtConfig.java
│   │               │   │   ├── AsyncConfig.java
│   │               │   │   ├── CorsConfig.java
│   │               │   │   └── WebConfig.java
│   │               │   │
│   │               │   ├── security/
│   │               │   │   ├── JwtTokenProvider.java
│   │               │   │   ├── JwtAuthenticationFilter.java
│   │               │   │   └── CustomUserDetails.java
│   │               │   │
│   │               │   ├── error/
│   │               │   │   ├── GlobalExceptionHandler.java
│   │               │   │   ├── ErrorCode.java
│   │               │   │   ├── ErrorResponse.java
│   │               │   │   └── BusinessException.java
│   │               │   │
│   │               │   ├── common/
│   │               │   │   ├── BaseEntity.java
│   │               │   │   └── ApiResponse.java
│   │               │   │
│   │               │   └── util/
│   │               │       └── DateTimeUtil.java
│   │               │
│   │               ├── domain/
│   │               │   │
│   │               │   ├── auth/
│   │               │   │   ├── controller/
│   │               │   │   │   └── AuthController.java
│   │               │   │   ├── service/
│   │               │   │   │   ├── AuthService.java
│   │               │   │   │   └── KakaoOAuthClient.java
│   │               │   │   ├── repository/
│   │               │   │   │   └── RefreshTokenRepository.java
│   │               │   │   ├── entity/
│   │               │   │   │   └── RefreshToken.java
│   │               │   │   └── dto/
│   │               │   │       ├── KakaoTokenResponse.java
│   │               │   │       ├── KakaoUserInfo.java
│   │               │   │       ├── LoginResponse.java
│   │               │   │       └── TokenReissueRequest.java
│   │               │   │
│   │               │   ├── user/
│   │               │   │   ├── controller/
│   │               │   │   │   └── UserController.java
│   │               │   │   ├── service/
│   │               │   │   │   └── UserService.java
│   │               │   │   ├── repository/
│   │               │   │   │   └── UserRepository.java
│   │               │   │   ├── entity/
│   │               │   │   │   └── User.java
│   │               │   │   └── dto/
│   │               │   │       ├── UserProfileResponse.java
│   │               │   │       └── UserProfileUpdateRequest.java
│   │               │   │
│   │               │   ├── team/
│   │               │   │   ├── controller/
│   │               │   │   │   ├── TeamController.java
│   │               │   │   │   └── TeamInvitationController.java
│   │               │   │   ├── service/
│   │               │   │   │   ├── TeamService.java
│   │               │   │   │   └── TeamInvitationService.java
│   │               │   │   ├── repository/
│   │               │   │   │   ├── TeamRepository.java
│   │               │   │   │   ├── TeamMemberRepository.java
│   │               │   │   │   └── TeamInvitationRepository.java
│   │               │   │   ├── entity/
│   │               │   │   │   ├── Team.java
│   │               │   │   │   ├── TeamMember.java
│   │               │   │   │   ├── TeamInvitation.java
│   │               │   │   │   ├── TeamRole.java
│   │               │   │   │   └── InvitationStatus.java
│   │               │   │   └── dto/
│   │               │   │       ├── TeamCreateRequest.java
│   │               │   │       ├── TeamUpdateRequest.java
│   │               │   │       ├── TeamResponse.java
│   │               │   │       ├── TeamMemberResponse.java
│   │               │   │       ├── TeamInviteRequest.java
│   │               │   │       └── TeamInviteResponse.java
│   │               │   │
│   │               │   ├── schedule/
│   │               │   │   ├── controller/
│   │               │   │   │   └── ScheduleController.java
│   │               │   │   ├── service/
│   │               │   │   │   └── ScheduleService.java
│   │               │   │   ├── repository/
│   │               │   │   │   └── ScheduleRepository.java
│   │               │   │   ├── entity/
│   │               │   │   │   ├── Schedule.java
│   │               │   │   │   └── ScheduleType.java
│   │               │   │   ├── dto/
│   │               │   │   │   ├── ScheduleCreateRequest.java
│   │               │   │   │   ├── ScheduleUpdateRequest.java
│   │               │   │   │   ├── ScheduleResponse.java
│   │               │   │   │   ├── ScheduleListResponse.java
│   │               │   │   │   └── ScheduleDetailResponse.java
│   │               │   │   └── event/
│   │               │   │       ├── ScheduleCreatedEvent.java
│   │               │   │       ├── ScheduleUpdatedEvent.java
│   │               │   │       └── ScheduleDeletedEvent.java
│   │               │   │
│   │               │   └── notification/
│   │               │       ├── service/
│   │               │       │   ├── NotificationService.java
│   │               │       │   └── KakaoAlimtalkClient.java
│   │               │       ├── repository/
│   │               │       │   └── NotificationRepository.java
│   │               │       ├── entity/
│   │               │       │   ├── Notification.java
│   │               │       │   ├── NotificationType.java
│   │               │       │   └── NotificationStatus.java
│   │               │       └── listener/
│   │               │           └── NotificationEventListener.java
│   │               │
│   │               └── infra/
│   │                   └── kakao/
│   │                       ├── KakaoApiClient.java
│   │                       ├── KakaoApiProperties.java
│   │                       └── dto/
│   │                           ├── KakaoAlimtalkRequest.java
│   │                           └── KakaoAlimtalkResponse.java
│   │
│   └── resources/
│       ├── application.yml
│       ├── application-dev.yml
│       ├── application-prod.yml
│       └── db/
│           └── migration/
│               ├── V1__init_users.sql
│               ├── V2__init_teams.sql
│               ├── V3__init_schedules.sql
│               └── V4__init_notifications.sql
│
└── test/
    └── java/
        └── com/
            └── jsk/
                └── schedule/
                    ├── domain/
                    │   ├── auth/service/AuthServiceTest.java
                    │   ├── team/service/TeamServiceTest.java
                    │   ├── team/service/TeamInvitationServiceTest.java
                    │   ├── schedule/service/ScheduleServiceTest.java
                    │   └── notification/service/NotificationServiceTest.java
                    └── global/security/JwtTokenProviderTest.java
```

**패키지 구조 설계 결정 사유:**
1. **도메인별 패키지 분리**: 기능 단위 응집, 특정 도메인 수정 시 해당 패키지만 확인
2. **global 패키지**: 보안, 예외 처리, 공통 엔티티 등 공통 관심사 집중
3. **infra 패키지**: 외부 API 연동 코드 분리, 카카오 API 변경 시 영향 범위 제한
4. **event 패키지**: schedule → notification 단방향 의존만 유지하기 위한 이벤트 기반 분리

---

## 4. REST API 명세

### 4.1 공통 사항

**Base URL:** `/api`

**공통 응답 형식:**

```json
// 성공 응답
{
  "status": "SUCCESS",
  "data": { ... },
  "message": null
}

// 에러 응답
{
  "status": "ERROR",
  "data": null,
  "message": "에러 메시지"
}

// 목록 응답 (페이징)
{
  "status": "SUCCESS",
  "data": {
    "content": [ ... ],
    "page": 0,
    "size": 20,
    "totalElements": 45,
    "totalPages": 3
  },
  "message": null
}
```

**공통 헤더:** `Authorization: Bearer {accessToken}`

**공통 에러 코드:**

| HTTP Status | 코드 | 설명 |
|-------------|------|------|
| 400 | BAD_REQUEST | 요청 파라미터 오류 |
| 401 | UNAUTHORIZED | 인증 실패 / 토큰 만료 |
| 403 | FORBIDDEN | 권한 없음 |
| 404 | NOT_FOUND | 리소스 없음 |
| 409 | CONFLICT | 리소스 충돌 (중복 등) |
| 500 | INTERNAL_SERVER_ERROR | 서버 내부 오류 |

---

### 4.2 인증 API

#### POST /api/auth/kakao/callback
카카오 OAuth 로그인/회원가입. 미가입 사용자는 자동 회원가입.

**요청:** `{ "code": "카카오_인증_코드" }`

**응답 (200):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": 1,
      "name": "홍길동",
      "email": "hong@kakao.com",
      "profileImageUrl": "https://k.kakaocdn.net/..."
    },
    "isNewUser": true
  }
}
```

#### POST /api/auth/reissue
Access Token 재발급 (Refresh Token 기반, Rotation 적용).

**요청:** `{ "refreshToken": "eyJ..." }`

**응답 (200):** `{ "accessToken": "...", "refreshToken": "...(새 토큰)", "tokenType": "Bearer", "expiresIn": 3600 }`

#### POST /api/auth/logout
**요청:** `{ "refreshToken": "eyJ..." }` | **응답 (200):** 성공 메시지

---

### 4.3 사용자 API

| 메서드 | URL | 설명 | 권한 |
|--------|-----|------|------|
| GET | `/api/users/me` | 내 프로필 조회 (소속 팀 목록 포함) | 인증 |
| PUT | `/api/users/me` | 내 프로필 수정 (이름) | 인증 |

---

### 4.4 팀 API

| 메서드 | URL | 설명 | 권한 |
|--------|-----|------|------|
| POST | `/api/teams` | 팀 생성 | Member/Admin |
| GET | `/api/teams` | 내 팀 목록 | 인증 |
| GET | `/api/teams/{teamId}` | 팀 상세 조회 | 인증 |
| PUT | `/api/teams/{teamId}` | 팀 정보 수정 | Admin |
| GET | `/api/teams/{teamId}/members` | 팀원 목록 조회 | Member/Admin |
| POST | `/api/teams/{teamId}/invitations` | 팀원 초대 (카카오 ID 기반) | Admin |
| POST | `/api/invitations/{token}/accept` | 초대 수락 | 초대 대상자 |
| POST | `/api/invitations/{token}/reject` | 초대 거절 | 초대 대상자 |
| DELETE | `/api/teams/{teamId}/members/{userId}` | 팀원 추방 | Admin |
| DELETE | `/api/teams/{teamId}/members/me` | 팀 자발적 탈퇴 | Member/Admin |
| PUT | `/api/teams/{teamId}/members/{userId}/role` | 역할 변경 (Admin 위임) | Admin |

**팀 생성 요청:**
```json
{ "name": "개발팀", "description": "백엔드 개발팀" }
```

> **첫 번째 팀 예외**: 최초 1회에 한해 팀 미소속 User도 팀 생성 가능. 이후부터는 Member/Admin만 가능.

**팀원 초대 요청:**
```json
{ "kakaoId": 123456789 }
```

**초대 응답 (201):** 초대 링크 + 만료일시(7일) 포함

---

### 4.5 일정 API

| 메서드 | URL | 설명 | 권한 |
|--------|-----|------|------|
| POST | `/api/teams/{teamId}/schedules` | 일정 등록 | Member/Admin |
| GET | `/api/teams/{teamId}/schedules` | 일정 목록 조회 | 인증 (비소속 가능) |
| GET | `/api/teams/{teamId}/schedules/{scheduleId}` | 일정 상세 조회 | 인증 (비소속 가능) |
| PUT | `/api/teams/{teamId}/schedules/{scheduleId}` | 일정 수정 | 본인 또는 Admin |
| DELETE | `/api/teams/{teamId}/schedules/{scheduleId}` | 일정 삭제 (소프트 딜리트) | 본인 또는 Admin |
| GET | `/api/teams/{teamId}/schedules/archived` | 아카이브 일정 조회 | Admin |

**일정 등록 요청:**
```json
{
  "title": "스프린트 회의",
  "description": "2월 4주차 리뷰",
  "type": "TEAM",
  "startAt": "2026-02-23T10:00:00",
  "endAt": "2026-02-23T11:30:00",
  "allDay": false
}
```

**일정 조회 쿼리 파라미터:** `startDate`, `endDate`, `type` (선택)

**상세 조회 응답:** `canEdit`, `canDelete` 필드로 권한 기반 수정/삭제 버튼 노출 여부 제공

> **비소속 사용자 조회**: 제목/유형/시간 공개, description은 null로 반환

---

## 5. 미결정 사항 해결 종합

| 결정 항목 | 결정 | 사유 |
|-----------|------|------|
| 팀 이름 중복 허용 | **허용** | 서로 다른 조직의 동일 이름은 자연스러움, ID로 구분 가능 |
| 과거 날짜 일정 등록 | **허용** | 소급 등록 필요성 존재 (지난 회의, 이전 휴가 기록) |
| 미가입 사용자 초대 | **카카오 ID 기반, 가입 후 수락** | invitee_kakao_id로 기록, 초대 링크 클릭 시 가입 유도 후 자동 연결 |
| 초대 링크 유효 기간 | **7일** | 주말/공휴일 고려 시 24시간은 너무 짧음 |
| 알림 발송 이력 저장 | **저장** | 실패 추적, 운영 모니터링, 향후 이력 조회 기능 확장 |
| 타 팀 일정 조회 범위 | **제목/유형/시간 공개, description 비공개** | 가시성 확보 + 프라이버시 보호 균형 |
| 한 사용자 최대 팀 소속 수 | **10개** | 알림 폭증 방지, 실무 환경에서 충분 |
| 데이터베이스 | **Supabase (PostgreSQL)** | BaaS, 클라우드 관리형 DB, 별도 서버 운영 불필요 |
| 빌드 도구 | **Gradle** | Spring Boot 기본 권장, 빌드 속도 우수 |
| 프론트엔드 | **React** | 캘린더 SPA UX, FullCalendar 통합, JWT 인증 친화적 |
| 배포 플랫폼 | **Render** | 간편한 클라우드 배포, GitHub 연동 자동 CI/CD |
| 소스관리/CI·CD | **GitHub** | 코드 버전관리 및 Render 자동 배포 트리거 |
