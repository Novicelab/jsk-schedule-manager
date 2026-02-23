# JSK 일정 관리 서비스 - 변경 로그

모든 주요 업데이트 및 개선사항을 시간순으로 기록합니다.

---

## [2026-02-23] Supabase 중심 구조 전환 (아키텍처 리팩토링)

### 배경
- Spring Boot 백엔드를 별도 Docker 서비스로 운영하는 것이 비효율적
- Supabase를 단순 DB로만 사용 중 (Auth, RLS, Edge Functions 미활용)
- Java + JavaScript 2개 언어 유지보수 부담

### 변경사항

**구조 변경: 3-tier → Supabase BaaS**
- Before: `React → Spring Boot (Docker) → Supabase PostgreSQL`
- After: `React → Supabase Client (Auth + RLS + Edge Functions)`

**제거된 항목 (Spring Boot 백엔드 전체):**
- `src/` 디렉토리 (Java 64개 파일)
- `Dockerfile`, `build.gradle`, `settings.gradle`, `gradle/`, `gradlew`
- `application.yml`, `application-prod.yml`, `application-local.yml`, `application-dev.yml`
- `test_api.sh`, `test_login.sh`

**추가된 항목:**
- `supabase/config.toml` - Supabase 프로젝트 설정
- `supabase/functions/kakao-auth/index.ts` - 카카오 OAuth Edge Function
- `supabase/functions/send-notification/index.ts` - 알림톡 발송 Edge Function
- `frontend/src/lib/supabase.js` - Supabase Client 설정
- `docs/migrations/supabase_migration.sql` - RLS + 트리거 마이그레이션

**수정된 프론트엔드 파일 (12개):**
- `frontend/src/api/client.js` → 삭제 (Axios 제거)
- `frontend/src/lib/supabase.js` → 신규 (Supabase Client)
- `frontend/src/pages/LoginPage.jsx` → Supabase Auth 세션 체크
- `frontend/src/pages/CallbackPage.jsx` → Edge Function 호출
- `frontend/src/pages/CalendarPage.jsx` → Supabase 직접 쿼리
- `frontend/src/components/schedule/ScheduleModal.jsx` → Supabase insert/update
- `frontend/src/components/schedule/ScheduleDetail.jsx` → Supabase soft delete
- `frontend/src/components/auth/NameInputModal.jsx` → Supabase update
- `frontend/src/components/Navbar.jsx` → supabase.auth.signOut()
- `frontend/src/components/settings/NotificationSettings.jsx` → Supabase 쿼리
- `frontend/src/hooks/useAuth.js` → Supabase Auth 상태 관리
- `frontend/src/components/PrivateRoute.jsx` → Supabase 세션 기반

**배포 설정 변경:**
- `render.yaml`: Backend 서비스 제거, Frontend Static Site만 유지
- `frontend/.env`: `VITE_API_BASE_URL` 제거, `VITE_SUPABASE_URL/ANON_KEY` 추가
- `frontend/vite.config.js`: proxy 설정 제거

**패키지 변경:**
- 추가: `@supabase/supabase-js`
- 제거: `axios`

### 비고
- DB 마이그레이션 SQL은 Supabase SQL Editor에서 수동 실행 필요
- Edge Functions는 `supabase functions deploy`로 별도 배포 필요
- Supabase Anon Key, Service Role Key 설정 필요

---

## [2026-02-22] 캘린더 UI/UX 개선 및 403 Forbidden 에러 수정

### 문제 분석
1. **모바일 이벤트 클릭 이슈**: 모바일에서 일정 dot 클릭 시 바텀 시트를 거치지 않고 바로 상세 팝업 표시
   - 의도: 모바일 → 바텀 시트(날짜별 일정 목록) → PC → 상세 팝업
2. **[오늘] 버튼 노출**: 캘린더 헤더에 [오늘] 버튼이 표시됨 (UI 정리 필요)
3. **403 Forbidden 에러**: 가끔 일정 로드 실패
   - 원인: Spring Security 미인증 요청 시 기본값으로 **403** 반환 (401이어야 함)
   - 프론트엔드 인터셉터는 **401에만** 토큰 재발급 로직 실행 → 403 수신 시 재발급 불가

### 변경사항

**백엔드 (`src/main/java/com/jsk/schedule/global/config/SecurityConfig.java`):**
- `AuthenticationEntryPoint` 추가: 미인증 요청 시 **401** 반환 (기본 403 대신)
  - JSON 응답: `{ "code": "UNAUTHORIZED", "message": "인증이 필요합니다.", "data": null }`
- import 추가: `ObjectMapper`, `MediaType`, `HashMap`, `Map`, `IOException`

**프론트엔드 (`frontend/src/pages/CalendarPage.jsx`):**
- L183 headerToolbar 수정: `left: 'prev,next today'` → `left: 'prev,next'` ([오늘] 버튼 제거)
- L110-137 `handleEventClick` 수정: 모바일/PC 분기 처리
  - 모바일: 해당 날짜의 바텀 시트(날짜별 일정 목록) 표시
  - PC: 기존대로 일정 상세 팝업 표시
  - dependency 추가: `[isMobile, events]`

### 파일 변경
- `src/main/java/com/jsk/schedule/global/config/SecurityConfig.java`: AuthenticationEntryPoint 추가
- `frontend/src/pages/CalendarPage.jsx`: [오늘] 버튼 제거 + 모바일 이벤트 클릭 분기

### 검증 방법
1. 백엔드 빌드 후 토큰 만료 시뮬레이션 → HTTP 401 응답 확인
2. 프론트엔드 개발 서버:
   - 모바일 너비(< 768px): dot 클릭 → 바텀 시트 표시 확인
   - PC 너비(≥ 768px): 이벤트 클릭 → 상세 팝업 표시 확인
   - [오늘] 버튼 사라짐 확인
3. Render 자동 배포 후 프로덕션 서비스 확인

---

## [2026-02-22] QA 버그 수정 - POST /api/auth/reissue 엔드포인트 누락

### 발견 경위
- QA 팀 E2E 테스트 중 토큰 재발급 API 호출 시 500 에러 확인
- 소스 분석 결과: TokenReissueRequest DTO, RefreshToken Entity/Repository는 존재하나
  AuthService.reissue() 메서드 및 AuthController POST /reissue 엔드포인트 완전 누락 확인

### 영향
- Access Token 만료(1시간) 후 자동 갱신 불가 → 사용자 강제 로그아웃 발생
- 장시간 사용 시 서비스 사용 불가 상태

### 변경사항

**백엔드 (`AuthService.java`):**
- `reissue(String refreshToken)` 메서드 추가
  - DB에서 RefreshToken 조회 → 만료 체크 → JWT 서명 검증 → 기존 토큰 삭제(Rotation) → 새 토큰 발급

**백엔드 (`AuthController.java`):**
- `POST /api/auth/reissue` 엔드포인트 추가 (`TokenReissueRequest` 사용, `ApiResponse<LoginResponse>` 반환)
- import `TokenReissueRequest` 추가

### 파일 변경
- `src/main/java/.../auth/service/AuthService.java`: reissue() 메서드 추가
- `src/main/java/.../auth/controller/AuthController.java`: /reissue 엔드포인트 추가

---

## [2026-02-22] 연동 설정 추가 수정 (KAKAO_CLIENT_ID 하드코딩, 백엔드 자동배포 설정)

### 변경사항

**백엔드 설정 (`src/main/resources/application-prod.yml`):**
- `kakao.client-id` 환경변수 의존 제거 → REST API 키 직접 하드코딩
  - 기존: `${KAKAO_CLIENT_ID}` (Render 대시보드 env var에 의존 → "1389155" 잔류 위험)
  - 변경: `"240f33554023d9ab4957b2d638fb0d71"` (소스에 직접 명시)
  - 근거: KAKAO_CLIENT_ID는 공개값 (OAuth URL에서도 노출됨)

**배포 설정 (`render.yaml`):**
- 백엔드 서비스에 `branch: main`, `autoDeployTrigger: commit` 추가 (프론트엔드와 동일하게)
- 백엔드 섹션에서 `KAKAO_CLIENT_ID` env var 항목 제거 (application-prod.yml에 직접 명시)

### 파일 변경
- `src/main/resources/application-prod.yml`: kakao.client-id 하드코딩
- `render.yaml`: 백엔드 자동배포 트리거 추가, KAKAO_CLIENT_ID env var 제거

---

## [2026-02-22] 연동 설정 버그 수정 (render.yaml KAKAO_CLIENT_ID, Dockerfile HEALTHCHECK, client.js 포트)

### 변경사항

**배포 설정 (`render.yaml`):**
- `KAKAO_CLIENT_ID` 오류 수정: 앱 번호(`1389155`) → REST API 키(`240f33554023d9ab4957b2d638fb0d71`)
  - backend 섹션 + frontend 섹션 모두 수정
  - 기존 오류로 프로덕션 카카오 로그인 시 KOE101 에러 발생 가능

**Docker (`Dockerfile`):**
- HEALTHCHECK 제거: `spring-boot-starter-actuator` 미설치로 `/actuator/health` 엔드포인트 미존재
  - 헬스체크가 항상 실패하여 Docker가 컨테이너를 unhealthy로 마킹하던 문제 해결
  - Render는 자체 헬스체크 메커니즘을 사용하므로 영향 없음

**프론트엔드 (`frontend/src/api/client.js`):**
- 로컬 폴백 URL 포트 수정: `8081` → `9090` (실제 로컬 백엔드 포트 일치)

### 파일 변경
- `render.yaml`: KAKAO_CLIENT_ID 값 수정 (backend + frontend)
- `Dockerfile`: HEALTHCHECK 명령어 제거
- `frontend/src/api/client.js`: 폴백 포트 수정

---

## [2026-02-22] UI/UX 3가지 개선 (휴가 제목 선택, GNB 계정 정보, 캘린더 반응형)

### 변경사항

**백엔드:**
- `ScheduleCreateRequest.java` 수정:
  - `@NotBlank` 제거, `@Size` 유지 (null 허용)
  - `isTitleValidForType()` 메서드 추가: WORK만 title 필수, VACATION은 선택
- `ScheduleUpdateRequest.java` 수정:
  - 동일하게 `@NotBlank` 제거, 커스텀 검증 추가
- `ScheduleService.java` 수정:
  - `createSchedule()` L48-52: VACATION 부제목 지원 개선
    - 사용자 입력 있을 시: `[이름] 부제목` (예: `[홍길동] 오전 반차`)
    - 사용자 입력 없을 시: `[이름]` (예: `[홍길동]`)
  - `updateSchedule()`: 동일 로직 적용

**프론트엔드:**
- `ScheduleModal.jsx` 수정:
  - VACATION 섹션에 부제목 입력 필드 추가 (선택 입력)
  - L164: `title = form.title.trim()` (백엔드에서 "[이름]" 포맷 처리)
  - L41-61: 수정 모드에서 저장된 title에서 부제목 추출 로직 추가
  - validate() 함수: VACATION 부제목 길이 검증 추가
- `Navbar.jsx` 수정:
  - localStorage에서 user 정보 읽기
  - `{user.name} / {user.email}` 형식으로 GNB에 표시
  - `.navbar-center` 추가, navbar-user-info 스타일 적용
- `CalendarPage.jsx` 수정:
  - 모바일 감지 state 추가 (window.innerWidth < 768)
  - 리사이즈 이벤트 리스너 추가
  - `handleDateClick()` 분기: 모바일 → 팝업, 데스크톱 → 모달
  - FullCalendar props 조건부:
    - 모바일: `eventContent` 도트 표시, `dayMaxEvents=1`
    - 데스크톱: 기존 block 표시
  - DateEventsPopup 인라인 컴포넌트 추가
    - 선택 날짜 이벤트 목록 표시
    - 이벤트 클릭 → ScheduleDetail
    - "일정 추가" 버튼 → ScheduleModal
    - 배경 클릭 시 닫기

- `global.css` 수정:
  - `.navbar-user-info`, `.navbar-center` 스타일 추가
  - `.mobile-event-dot` 스타일 추가 (8px 원형 도트)
  - `.date-popup-overlay`, `.date-popup` 관련 스타일 추가 (20개 스타일)
  - 모바일 반응형 처리 (@media max-width: 768px)

### 기능 상세

**Feature 1: 휴가 제목 선택사항**
- 휴가(VACATION) 등록 시 제목 입력은 선택사항
- 백엔드에서 자동으로 `[사용자이름]` 또는 `[사용자이름] 부제목` 형식으로 저장
- 업무(WORK) 등록 시 제목은 필수 (기존과 동일)

**Feature 2: GNB 계정 정보 표시**
- Navbar 중앙에 로그인한 사용자의 이름과 이메일 표시
- 형식: `홍길동 / hong@kakao.com`
- 반응형 처리: 화면 좁을 때 텍스트 중앙 정렬

**Feature 3: 캘린더 반응형 UI**
- 768px 미만(모바일): 날짜별 이벤트 1개 표시 → 도트로 축약, 날짜 클릭 시 팝업
- 768px 이상(데스크톱): 기존 동작 유지 (모든 이벤트 표시, 날짜 클릭 시 모달)
- DateEventsPopup: 선택 날짜의 모든 이벤트 목록 표시 및 상호작용

### 테스트 확인 사항

- [ ] 휴가 등록: 제목 없이 저장 → `[홍길동]` 확인
- [ ] 휴가 등록: "오전 반차" 입력 → `[홍길동] 오전 반차` 확인
- [ ] 업무 일정: 제목 없이 제출 → 에러 메시지 확인
- [ ] GNB: 로그인 후 이름/이메일 표시 확인
- [ ] 모바일(768px 미만): 이벤트 도트 표시 확인
- [ ] 모바일: 날짜 클릭 → DateEventsPopup 표시 확인
- [ ] 모바일: 팝업에서 "일정 추가" 클릭 → ScheduleModal 열림 확인
- [ ] 데스크톱(768px+): 기존 동작 유지 확인

### 파일 변경

**백엔드:**
- `src/main/java/com/jsk/schedule/domain/schedule/dto/ScheduleCreateRequest.java`
- `src/main/java/com/jsk/schedule/domain/schedule/dto/ScheduleUpdateRequest.java`
- `src/main/java/com/jsk/schedule/domain/schedule/service/ScheduleService.java`

**프론트엔드:**
- `frontend/src/components/schedule/ScheduleModal.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/pages/CalendarPage.jsx`
- `frontend/src/styles/global.css`

---

## [2026-02-22] 신규 회원가입 이름 입력 팝업 기능 복구

### 변경사항

**백엔드:**
- `LoginResponse.java` 수정:
  - `isNewUser` 필드에 `@JsonProperty` 애너테이션 추가
  - boolean 필드의 JSON 직렬화 명시적 처리
- `AuthService.java` 수정:
  - `kakaoLogin()` 메서드 로깅 강화
  - isNewUser 플래그 최종 확인 로그 추가

**프론트엔드:**
- `CallbackPage.jsx` 수정:
  - 응답 구조 디버깅 로그 추가
  - isNewUser 값 및 타입 명시적 로깅
  - 신규/기존 사용자 분기 처리 로그 추가

### 문제 해결

- ❌ **문제**: 신규 회원가입 후 이름 입력 팝업이 표시되지 않음
- ✅ **원인**: LoginResponse의 `isNewUser` 필드 JSON 직렬화 문제
- ✅ **해결**: @JsonProperty 애너테이션 추가 및 디버깅 로그 강화

### 동작 흐름

```
신규 사용자 → 카카오 로그인
→ AuthService: isNewUser=true 설정
→ LoginResponse: isNewUser 필드 포함하여 반환
→ CallbackPage: isNewUser 감지 → NameInputModal 표시
→ NameInputModal: 사용자가 이름 입력
→ PUT /users/me로 이름 업데이트 후 메인으로 이동
```

### 배포 정보

- 커밋: 36e2410
- 상태: Render 자동 배포 진행 중 (5-10분)
- 테스트: 신규 회원 로그인 후 이름 입력 팝업 확인 필요

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
