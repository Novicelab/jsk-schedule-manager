# JSK 일정 관리 서비스 - 변경 로그

모든 주요 업데이트 및 개선사항을 시간순으로 기록합니다.

---

## [2026-02-22] CORS 설정 강화 - 마이페이지 알림 설정 CORS 에러 해결

### 변경사항

**백엔드:**
- `CorsConfig.java` 수정:
  - 환경 변수 누락 시 기본값 추가 (https://jsk-schedule-frontend.onrender.com)
  - 콤마 구분 origins 정규식 개선 (공백 처리)
  - allowedMethods를 "*"로 확대 (모든 HTTP 메서드 지원)
  - CORS preflight 요청 캐시 타임 추가 (3600초)

### 문제 해결

- ❌ **문제**: 프로덕션 마이페이지에서 알림 설정 조회 시 CORS 에러 발생
  - 에러: "No 'Access-Control-Allow-Origin' header is present"
  - 엔드포인트: `GET /api/users/me/notification-preferences`
- ✅ **원인**: 환경 변수 미설정 시 CORS 기본값 부재로 인한 헤더 누락
- ✅ **해결**: CorsConfig에 기본값 및 예외 처리 강화

### 배포 정보

- 커밋: bfbc394 (수정버전 - allowedMethods 명시적 메서드 사용)
- 상태: Render 자동 배포 진행 중 (5-10분)

---

## [2026-02-21] 마이페이지 및 알림 설정 기능 추가

### 변경사항

**프론트엔드:**
- GNB(Navbar)에 "설정" 버튼 추가 → `/mypage` 경로로 이동
- `/mypage` 라우트 추가 (PrivateRoute 보호)
- `MyPage.jsx` 신규 생성: 마이페이지 UI (뒤로가기 + 알림 설정 섹션)
- `NotificationSettings.jsx` 신규 생성:
  - 휴가/업무 × 등록/수정/삭제 6개 토글 버튼 (3x2 그리드)
  - `GET /api/users/me/notification-preferences` 초기 로드
  - `PUT /api/users/me/notification-preferences/{key}` 토글 시 즉시 반영
  - 토글 성공 시 "켜짐/꺼짐" 피드백 표시
- CSS 추가: `.navbar-actions`, `.btn-settings`, `.mypage-*`, `.notification-settings-*`, `.toggle-*`

**백엔드:**
- `NotificationActionType` Enum 신규 생성 (CREATED, UPDATED, DELETED)
- `NotificationPreference` 엔티티 신규 생성 (`notification_preferences` 테이블)
- `NotificationPreferenceRepository` 신규 생성
- `NotificationPreferenceResponse` DTO 신규 생성
- `NotificationPreferenceUpdateRequest` DTO 신규 생성
- `NotificationPreferenceService` 신규 생성:
  - `initializeDefaultPreferences()`: 신규 가입 시 6개 기본 설정 생성(모두 true)
  - `getPreferences()`: 전체 설정 조회 (없으면 자동 초기화)
  - `updatePreference()`: 개별 설정 업데이트
  - `isNotificationEnabled()`: 알림 발송 전 수신 여부 확인
- `UserController` 수정: 알림 설정 GET/PUT API 2개 추가
- `NotificationService` 수정:
  - `sendNotificationToUser()`: 발송 전 사용자 수신 설정 확인 로직 추가
  - `buildMessage()`: 휴가/업무 유형별 포맷 분리 (사용자명, 날짜/시간 포함)
- `AuthService` 수정: 신규 카카오 사용자 가입 시 알림 기본 설정 자동 생성

**데이터베이스:**
- `docs/migrations/add_notification_preferences.sql` 신규 생성 (Supabase 수동 실행용)

### 파일 변경
**신규 생성 (백엔드):**
- `src/main/java/com/jsk/schedule/domain/notification/entity/NotificationActionType.java`
- `src/main/java/com/jsk/schedule/domain/notification/entity/NotificationPreference.java`
- `src/main/java/com/jsk/schedule/domain/notification/repository/NotificationPreferenceRepository.java`
- `src/main/java/com/jsk/schedule/domain/notification/dto/NotificationPreferenceResponse.java`
- `src/main/java/com/jsk/schedule/domain/notification/dto/NotificationPreferenceUpdateRequest.java`
- `src/main/java/com/jsk/schedule/domain/notification/service/NotificationPreferenceService.java`

**수정 (백엔드):**
- `src/main/java/com/jsk/schedule/domain/user/controller/UserController.java`
- `src/main/java/com/jsk/schedule/domain/notification/service/NotificationService.java`
- `src/main/java/com/jsk/schedule/domain/auth/service/AuthService.java`

**신규 생성 (프론트엔드):**
- `frontend/src/pages/MyPage.jsx`
- `frontend/src/components/settings/NotificationSettings.jsx`

**수정 (프론트엔드):**
- `frontend/src/App.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/styles/global.css`

**신규 생성 (문서/마이그레이션):**
- `docs/migrations/add_notification_preferences.sql`

### 비고
- Supabase prod 환경은 `ddl-auto: none`이므로 마이그레이션 SQL 수동 실행 필요
- 로컬 H2 환경은 `ddl-auto: create`이므로 자동 테이블 생성
- 기존 사용자의 알림 설정 미존재 시 GET 호출 시 자동 초기화 (폴백 처리)

---

## [2026-02-21] 환경 설정 통합 - Kakao 로그인 포트/URI 일관성 수정

### 변경사항
- **환경 변수 통합 정리**: 로컬/프로덕션 환경의 포트 및 URI 불일치 문제 해결
  - 프론트엔드 포트: 3001 → **5173** (Vite 기본값으로 통합)
  - 백엔드 포트: 기존 9090 유지 (일관성)
  - Kakao Redirect URI: 모든 환경에서 정확히 일치하도록 수정

- **Kakao 로그인 오류 원인 분석 및 수정**:
  - 문제: Vite 환경 변수는 빌드 시점에 고정 → Render 배포 시 localhost URI로 컴파일됨
  - 해결: Render 환경 변수 설정 가이드 제공, 환경별 설정 분리

- **프론트엔드 설정 파일 수정**:
  - `frontend/.env`: 기존 값 유지 (로컬 개발용)
  - `frontend/.env.example`: 올바른 REST API Key (240f33554023d9ab4957b2d638fb0d71) 및 포트(9090) 반영
  - `frontend/vite.config.js`: 포트 5173, 프록시 대상 9090으로 수정

- **백엔드 설정 파일 수정**:
  - `application-local.yml`: CORS allowed-origins `http://localhost:3001` → `http://localhost:5173` 변경
  - `application-prod.yml`: 기존 설정 유지 (환경 변수로 로드)

- **문서화 추가**:
  - `docs/environment-setup.md`: 로컬/프로덕션 환경 설정 완벽 가이드 추가
  - `docs/render-deployment.md`: Render 배포 단계별 가이드 + 트러블슈팅 추가

### 파일 변경
**프론트엔드:**
- `frontend/.env.example`: 올바른 값 + 주석으로 프로덕션 설정 가이드 추가
- `frontend/vite.config.js`: port 5173, proxy target 9090 수정

**백엔드:**
- `src/main/resources/application-local.yml`: CORS allowed-origins 5173으로 수정

**문서:**
- `docs/environment-setup.md`: ✨ 신규 생성 (로컬/프로덕션 환경 설정 가이드)
- `docs/render-deployment.md`: ✨ 신규 생성 (Render 배포 가이드)

### 비고
- 로컬 개발 환경: 프론트엔드 5173, 백엔드 9090 → Kakao 리다이렉트 `http://localhost:5173/auth/callback`
- 프로덕션 (Render): 프론트엔드 `https://jsk-schedule-frontend.onrender.com`, 백엔드 `https://jsk-schedule-backend.onrender.com`
- Kakao 콘솔에 두 Redirect URI 모두 등록 필수
- Render 환경 변수 설정 시 `VITE_*` 변수는 빌드 시점에 컴파일되므로, 변경 후 반드시 "Clear Build Cache & Deploy" 실행

---

## [2026-02-21] 일정 생성 팝업 UX 개선 + 휴가 제목 자동 설정

### 변경사항
- **일정 생성 팝업 구조 개선**:
  * 유형 선택을 맨 위로 이동 (필수 입력 강조)
  * 라디오 버튼을 **박스 형태**로 스타일 변경 (시각적 개선)
  * 유형 선택에 따라 나머지 필드 동적 렌더링

- **유형별 입력 필드 조건부 표시**:
  * **VACATION (휴가)**: 날짜(from-to)만 표시
  * **WORK (업무)**: 제목, 설명, 날짜(from-to), 시간(from-to) 표시

- **휴가 제목 자동 설정**:
  * VACATION 타입 저장 시 제목을 `[사용자이름]휴가` 형식으로 자동 설정
  * 사용자가 제목 입력할 필요 없음

### 파일 변경
**프론트엔드:**
- `frontend/src/components/schedule/ScheduleModal.jsx`:
  * 유형 선택을 최상단으로 이동
  * 조건부 렌더링 로직 추가 (유형별 UI 분기)
  * 상태 관리 순서 개선 (type이 먼저)
- `frontend/src/components/schedule/ScheduleModal.css`:
  * `.type-box-group`: 박스 형태 라디오 버튼 레이아웃
  * `.type-box`: 박스 스타일 + 호버 효과
  * `.type-box-selected`: 선택 상태 스타일
  * `.form-section-hint`: 섹션별 안내 메시지

**백엔드:**
- `src/main/java/com/jsk/schedule/domain/schedule/service/ScheduleService.java`:
  * VACATION 타입 시 제목을 `[이름]휴가` 형식으로 자동 설정
  * 주석 개선

### 비고
- UX 개선으로 사용자가 더 명확하게 일정 유형을 선택
- 휴가 등록 시 불필요한 제목 입력 제거 (자동 생성)
- 박스 형태 선택지로 선택성이 더 명확해짐

---

## [2026-02-21] UI/UX 개선 + 다층 외래키 CASCADE 구조화

### 변경사항
- **일정 생성 팝업 개선**: 유형 선택을 `<select>` → 라디오 버튼으로 변경
  - 선택지 시각화 개선 (2개 항목 한눈에 비교 가능)
  - 호버 효과 및 상호작용성 향상
- **다층 외래키 CASCADE 설정**: 데이터 정합성 자동화
  - `users` ← `schedules` (created_by): ON DELETE CASCADE
  - `schedules` ← `notifications` (schedule_id): ON DELETE CASCADE
  - `users` ← `notifications` (user_id): ON DELETE CASCADE
  - User 삭제 시 관련 Schedule, Notification도 자동 삭제됨

### 파일 변경
**프론트엔드:**
- `frontend/src/components/schedule/ScheduleModal.jsx`: `<select>` → 라디오 버튼으로 변경
- `frontend/src/components/schedule/ScheduleModal.css`: 라디오 버튼 스타일 추가 (.radio-group, .radio-label, .radio-input 등)

**백엔드 (외래키 CASCADE - Hibernate 레벨):**
- `src/main/java/com/jsk/schedule/domain/schedule/entity/Schedule.java`:
  * @OnDelete(action = OnDeleteAction.CASCADE) 추가 (created_by 외래키)
- `src/main/java/com/jsk/schedule/domain/notification/entity/Notification.java`:
  * @OnDelete(action = OnDeleteAction.CASCADE) 추가 (schedule_id 외래키)
  * @OnDelete(action = OnDeleteAction.CASCADE) 추가 (user_id 외래키)
- `src/main/java/com/jsk/schedule/domain/auth/entity/RefreshToken.java`:
  * @OnDelete(action = OnDeleteAction.CASCADE) 추가 (user_id 외래키)

**데이터베이스 (PostgreSQL 레벨 - Supabase):**
- `ALTER TABLE schedules`: ON DELETE CASCADE 추가 (created_by 외래키)
- `ALTER TABLE notifications`: ON DELETE CASCADE 추가 (schedule_id, user_id 외래키)
- `ALTER TABLE refresh_tokens`: ON DELETE CASCADE 추가 (user_id 외래키)

### 비고
- Hibernate 6+ `@OnDelete` 애노테이션으로 Hibernate 레벨 CASCADE 처리
- **Supabase SQL 실행 완료**: PostgreSQL 외래키 제약에 ON DELETE CASCADE 수동 적용
  * 기존 외래키 삭제 후 새로운 외래키 추가 (DROP IF EXISTS → ADD CONSTRAINT)
  * 이제 Supabase에서도 User 삭제 가능 (관련 데이터 자동 삭제)
- 다층 CASCADE 구조 완성: `users` ← `refresh_tokens`, `schedules`, `notifications` 모두 CASCADE

---

## [2026-02-21] 카카오 신규 가입 시 이름 입력 팝업 + 휴가 말머리 자동 추가

### 변경사항
- **신규/기존 사용자 구분**: LoginResponse에 `isNewUser` 필드 추가
  - 신규 가입 시 `isNewUser=true` → 프론트엔드에서 이름 입력 팝업 표시
  - 기존 사용자 시 `isNewUser=false` → 바로 메인 페이지로 이동
- **신규 가입 처리**: 카카오 닉네임 대신 임시값 저장
  - 카카오 API 응답 nickname은 실명이 아닐 수 있음 → `__PENDING__` 임시값으로 저장
  - 사용자가 팝업에서 실제 이름 입력 후 `PUT /api/users/me`로 업데이트
- **이름 입력 팝업**: NameInputModal 컴포넌트 신규 생성
  - 필수 입력 필드 (최대 50자)
  - 배경 클릭/ESC 닫기 불가 (필수 입력이므로)
  - 입력 후 확인 버튼 클릭 시 user 정보 업데이트 + 메인 이동
- **VACATION 말머리 자동 추가**: 백엔드에서 휴가 일정의 제목에 이름 자동 추가
  - `ScheduleService.createSchedule()`: VACATION 타입 시 `[사용자이름] 원본제목` 형식으로 저장
  - WORK 타입은 원본 제목 그대로 저장
- **UI/UX 개선**: ScheduleModal에서 VACATION 선택 시 placeholder 힌트 표시
  - "예: 오전 반차 → 저장 시 [홍길동] 오전 반차" 형식으로 안내

### 파일 변경
**백엔드:**
- `src/main/java/com/jsk/schedule/domain/auth/dto/LoginResponse.java`: isNewUser 필드 추가
- `src/main/java/com/jsk/schedule/domain/auth/service/AuthService.java`: kakaoLogin() 메서드 수정 (신규/기존 구분, __PENDING__ 임시값)
- `src/main/java/com/jsk/schedule/domain/schedule/service/ScheduleService.java`: createSchedule() 메서드 수정 (VACATION 말머리 자동 추가)

**프론트엔드:**
- `frontend/src/pages/CallbackPage.jsx`: isNewUser 확인 → NameInputModal 표시 로직 추가
- `frontend/src/components/auth/NameInputModal.jsx`: ✨ 신규 생성 (이름 입력 모달)
- `frontend/src/components/auth/NameInputModal.css`: ✨ 신규 생성 (모달 스타일)
- `frontend/src/components/schedule/ScheduleModal.jsx`: VACATION 타입 시 placeholder 힌트 추가
- `frontend/src/components/schedule/ScheduleModal.css`: schedule-hint 스타일 추가

### 비고
- DB의 `name` 컬럼은 NOT NULL 제약이므로, 신규 가입 시 임시값(`__PENDING__`) 사용 필수
- NameInputModal은 PUT /api/users/me 엔드포인트 재사용 (기존 API 활용)
- VACATION 일정의 이름은 저장 시에만 추가되므로, 사용자가 제목 입력 시에는 "오전 반차" 같이 입력 후 백엔드에서 "[이름] 오전 반차"로 변환됨

---

## [2026-02-21] 카카오 로그인 버그 수정 (KAKAO_CLIENT_ID, nickname null 처리)

### 변경사항
- **KAKAO_CLIENT_ID 수정**: 앱 번호(1389155) → REST API 키(240f33554023d9ab4957b2d638fb0d71)
  - 프론트엔드 `frontend/.env`, 백엔드 `application-local.yml` 수정
  - Render 프론트엔드/백엔드 환경변수 수동 수정 (VITE_KAKAO_CLIENT_ID, KAKAO_CLIENT_ID)
- **nickname null 처리**: 카카오 프로필 미동의 시 `name` NOT NULL 제약 위반 500 에러 수정
  - nickname null 또는 blank 시 `카카오유저_{kakaoId}` 기본값으로 대체

### 파일 변경
- `frontend/.env`: VITE_KAKAO_CLIENT_ID 수정
- `src/main/resources/application-local.yml`: kakao.client-id 수정
- `src/main/java/com/jsk/schedule/domain/auth/service/AuthService.java`: nickname null 기본값 처리 추가

### 비고
- 카카오 개발자 콘솔 동의항목에서 프로필 정보를 필수로 설정하면 닉네임을 항상 받을 수 있음
- KOE101 에러(잘못된 앱 키) 해결 완료
- DB not-null constraint 위반 500 에러 해결 완료

---

## [2026-02-21] 카카오 OAuth 콜백 엔드포인트 구현

### 변경사항
- **카카오 OAuth 인증 흐름 완성**: 백엔드 콜백 엔드포인트 구현
  - `POST /api/auth/kakao/callback` 엔드포인트 추가 (AuthController)
  - AuthService에 `kakaoLogin()` 메서드 구현
  - Authorization Code → 카카오 Access Token 교환
  - 카카오 API에서 사용자 정보 조회 → 자동 가입/로그인
  - JWT 토큰 생성 및 Refresh Token 저장 (30일 유효)

- **테스트 코드 작성**: JUnit 5 기반 4개 단위 테스트 + 5개 통합 테스트
  - AuthServiceTest: kakaoLogin 메서드 테스트 (신규/기존 사용자, 에러 처리)
  - AuthControllerTest: 카카오 콜백 엔드포인트 테스트 (요청 검증, 응답 형식)

### 파일 변경
- `src/main/java/com/jsk/schedule/domain/auth/controller/AuthController.java`: 카카오 콜백 엔드포인트 추가
- `src/main/java/com/jsk/schedule/domain/auth/service/AuthService.java`: kakaoLogin() 메서드 추가 (카카오 OAuth 인증 로직)
- `src/main/java/com/jsk/schedule/domain/auth/entity/RefreshToken.java`: of() 메서드 추가 (토큰 생성 편의)
- `src/main/java/com/jsk/schedule/domain/auth/dto/KakaoLoginRequest.java`: ✨ 신규 생성 (Authorization Code DTO)
- `src/test/java/com/jsk/schedule/domain/auth/service/AuthServiceTest.java`: kakaoLogin 테스트 4개 추가
- `src/test/java/com/jsk/schedule/domain/auth/controller/AuthControllerTest.java`: ✨ 신규 생성 (카카오 콜백 테스트 5개)

### 비고
- 프론트엔드 CallbackPage에서 이미 구현된 `/api/auth/kakao/callback` 호출과 정렬
- KakaoOAuthClient 활용: 기존 카카오 API 클라이언트 재사용
- 신규 사용자: User.ofKakao() 생성 후 자동 저장
- 기존 사용자: 카카오 Access Token 갱신 후 로그인
- Refresh Token Rotation: 로그인 시 기존 토큰 삭제 후 신규 토큰 저장

---

## [2026-02-21] 로그인 페이지 UI 개선

### 변경사항
- **로그인 페이지 통합**: ID/비밀번호 로그인 제거, 카카오톡 소셜 로그인으로 통합
  - ID/비밀번호 로그인 UI 및 관련 폼 요소 제거
  - 카카오로 시작하기 버튼만 표시
  - 불필요한 CSS 클래스 정리 (`.login-divider`, `.btn-credential-login`, `.login-form` 등)

### 파일 변경
- `frontend/src/pages/LoginPage.jsx`: React 컴포넌트 간소화 (상태 관리 제거, 핸들러 통합)
- `frontend/src/styles/global.css`: 로그인 폼 관련 스타일 제거

### 비고
- 가입 여부 체크는 백엔드(CallbackPage)에서 처리
- 카카오 OAuth로 신규 사용자는 자동 가입, 기존 사용자는 로그인

---

## [2026-02-20] 일정 생성 모달 UI/UX 개선

### 변경사항
- 스카이스캐너 방식의 날짜 범위 선택 구현 (react-datepicker)
- 유형별 UI 분기 (팀 일정 vs 휴가)
- CalendarPage 보안 강화 (teamId null 체크)
- 날짜 오프셋 버그 해결 (toISOString 제거, 타임존 안전 포맷)

---
