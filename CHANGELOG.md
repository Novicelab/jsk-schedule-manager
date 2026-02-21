# JSK 일정 관리 서비스 - 변경 로그

모든 주요 업데이트 및 개선사항을 시간순으로 기록합니다.

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
