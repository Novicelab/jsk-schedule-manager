# JSK 일정 관리 서비스 - 변경 로그

모든 주요 업데이트 및 개선사항을 시간순으로 기록합니다.

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
