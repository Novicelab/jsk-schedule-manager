# JSK 일정 관리 서비스 - 변경 로그

모든 주요 업데이트 및 개선사항을 시간순으로 기록합니다.

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
