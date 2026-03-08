# QA 이슈 추적 - 2026-03-08 종합 점검

> **목적**: QA 종합 점검에서 발견된 모든 이슈를 우선순위별로 추적하고, 순차 수정 진행 상황을 기록합니다.
> **세션 연속성**: 세션이 끊어지더라도 이 파일을 참조하여 작업을 재개할 수 있습니다.

---

## 요약

| 우선순위 | 총 건수 | 완료 | 미완료 |
|----------|---------|------|--------|
| Critical | 3 | 3 | 0 |
| High | 4 | 4 | 0 |
| Medium | 6 | 6 | 0 |
| Low | 5 | 5 | 0 |
| **합계** | **18** | **18** | **0** |

---

## Critical (보안 취약점 - 즉시 수정 필요)

### C-1: CORS 와일드카드 (`Access-Control-Allow-Origin: *`)
- **상태**: ✅ 완료
- **위치**: 전체 Edge Functions (5개 모두)
- **수정**: `ALLOWED_ORIGINS` 화이트리스트 + `getCorsHeaders(req)` 함수로 변경
- **수정 파일**: 5개 Edge Function 모두

### C-2: kakao-auth 디버그 정보 노출
- **상태**: ✅ 완료
- **위치**: `supabase/functions/kakao-auth/index.ts`, `supabase/functions/update-user-name/index.ts`
- **수정**: 모든 에러 응답에서 `debug`, `details`, `code` 필드 제거, console.error 로깅만 유지

### C-3: 결정적 비밀번호 생성 (Deterministic Password)
- **상태**: ✅ 완료
- **위치**: `supabase/functions/kakao-auth/index.ts`
- **수정**: HMAC-SHA256 기반 `generateAuthPassword()` 함수 도입, 레거시 비밀번호 마이그레이션 폴백 유지

---

## High (높은 영향도 - 우선 수정)

### H-1: signOut fire-and-forget 레이스 컨디션
- **상태**: ✅ 완료
- **수정 1**: `CallbackPage.jsx` - cleanupAndRedirect를 async로 변경, signOut을 Promise.race로 최대 2초 대기
- **수정 2**: `LoginPage.jsx` - getSession에서 `__PENDING__` 사용자 세션 자동 정리

### H-2: 일정 UPDATE RLS만 의존 (Edge Function 미사용)
- **상태**: ✅ 완료
- **수정**: `update-schedule` Edge Function 신규 생성 (JWT 검증 + 소유권 확인 + Service Role UPDATE)
- **생성 파일**: `supabase/functions/update-schedule/index.ts`, `config.toml`

### H-3: localStorage 기반 created_by (IDOR 위험)
- **상태**: ✅ 완료
- **수정**: `ScheduleModal.jsx`에서 localStorage 기반 created_by 제거, update-schedule Edge Function이 auth_id로 서버사이드 설정

### H-4: deleted_at 필터링 검증 필요
- **상태**: ✅ 완료 (수정 불필요)
- **결과**: `schedules_with_user` 뷰에 이미 `WHERE s.deleted_at IS NULL` 필터 포함 확인

---

## Medium (중간 영향도 - 계획적 수정)

### M-1: history dummy 엔트리 잔존
- **상태**: ✅ 완료
- **수정**: onComplete에서 `history.back()` → popstate 리스너에서 navigate('/')로 dummy 엔트리 정리

### M-2: 이름 제출 + 백버튼 동시 레이스
- **상태**: ✅ 완료
- **수정**: onComplete 진입 시 `isExiting.current = true` 설정으로 레이스 방지

### M-3: CSRF state 우회 가능
- **상태**: ✅ 완료
- **수정**: `if (savedState && ...)` → `if (!savedState || ...)` 변경, savedState 없으면 에러 처리

### M-4: 관리자(Admin) 권한 미구현
- **상태**: ✅ 완료
- **수정**: CalendarPage handleEventDetail에서 `isAdmin = currentUser.role === 'ADMIN'` 체크 추가

### M-5: StrictMode 이중 pushState (개발 환경)
- **상태**: ✅ 완료
- **수정**: `if (!window.history.state?.nameModalTrap)` 조건으로 중복 pushState 방지

### M-6: 기존 비밀번호 호환 코드 정리
- **상태**: ✅ 완료
- **수정**: `[PASSWORD_MIGRATION]` 태그 로깅 추가, 마이그레이션 추적 가능하도록 보강

---

## Low (낮은 영향도 - 품질 개선)

### L-1: CallbackPage 세션 폴링 과다 (10초)
- **상태**: ✅ 완료
- **수정**: maxAttempts 100 → 30 (10초 → 3초)

### L-2: 미사용 NotificationSettings 컴포넌트 잔존
- **상태**: ✅ 완료
- **수정**: `frontend/src/components/settings/` 디렉토리 삭제

### L-3: MyPage delete-user 호출 불일치
- **상태**: ✅ 완료
- **수정**: `fetch()` → `supabase.functions.invoke('delete-user', ...)` 통일

### L-4: NameInputModal 이름 길이 제한 없음
- **상태**: ✅ 완료
- **수정**: maxLength 20자 제한 + 유효성 검사 추가

### L-5: App.jsx Error Boundary 부재
- **상태**: ✅ 완료
- **수정**: `ErrorBoundary.jsx` 컴포넌트 생성, App.jsx 최상위에 래핑

---

## 수정 이력

| 날짜 | 이슈 | 상태 | 비고 |
|------|------|------|------|
| 2026-03-09 | C-1 | ✅ | CORS 화이트리스트 (5개 Edge Function) |
| 2026-03-09 | C-2 | ✅ | debug/details 필드 제거 (kakao-auth, update-user-name) |
| 2026-03-09 | C-3 | ✅ | HMAC-SHA256 비밀번호 생성 |
| 2026-03-09 | H-1 | ✅ | signOut await + __PENDING__ 체크 |
| 2026-03-09 | H-2, H-3 | ✅ | update-schedule Edge Function 생성 |
| 2026-03-09 | H-4 | ✅ | 수정 불필요 (뷰에 필터 존재) |
| 2026-03-09 | M-1, M-2 | ✅ | history 정리 + 레이스 방지 |
| 2026-03-09 | M-3 | ✅ | CSRF state 필수 검증 |
| 2026-03-09 | M-4 | ✅ | Admin 역할 체크 추가 |
| 2026-03-09 | M-5 | ✅ | StrictMode 이중 pushState 방지 |
| 2026-03-09 | M-6 | ✅ | 레거시 비밀번호 마이그레이션 로깅 |
| 2026-03-09 | L-1~L-5 | ✅ | 폴링 단축, 미사용 파일 삭제, API 통일, 입력 검증, Error Boundary |

---

## Edge Function 배포 체크리스트

수정 완료 후 배포 필요한 Edge Functions:
- [ ] `kakao-auth` (C-1, C-2, C-3, M-6)
- [ ] `send-notification` (C-1)
- [ ] `update-user-name` (C-1, C-2)
- [ ] `delete-user` (C-1)
- [ ] `soft-delete-schedule` (C-1)
- [ ] `update-schedule` (H-2, H-3 - 신규)

```bash
# 배포 명령어
supabase functions deploy kakao-auth --project-ref qphhpfolrbsyiyoevaoe
supabase functions deploy send-notification --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy update-user-name --project-ref qphhpfolrbsyiyoevaoe
supabase functions deploy delete-user --project-ref qphhpfolrbsyiyoevaoe
supabase functions deploy soft-delete-schedule --project-ref qphhpfolrbsyiyoevaoe
supabase functions deploy update-schedule --project-ref qphhpfolrbsyiyoevaoe
```
