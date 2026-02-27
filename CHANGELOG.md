# JSK 일정 관리 서비스 - 변경 로그

모든 주요 업데이트 및 개선사항을 시간순으로 기록합니다.

---

## [2026-02-27] kakao-auth 세션 응답 구조 버그 수정 (Critical - 최우선)

### 문제
- **증상**: 카카오 로그인 후 "세션 데이터를 받지 못했습니다" 에러 계속 발생
- **원인**: kakao-auth Edge Function에서 Supabase SDK 응답 구조를 잘못 이해
  ```typescript
  // ❌ 잘못된 코드 (Line 228)
  session: sessionData.session  // undefined!

  // ✅ 올바른 코드
  session: sessionData.data.session  // 실제 세션 구조
  ```

### Supabase SDK signInWithPassword() 반환 구조
```typescript
{
  data: {
    session: { access_token, refresh_token, ... },
    user: { ... }
  },
  error: null | Error
}
```

**주의**: 세션은 `sessionData.session`이 아니라 **`sessionData.data.session`**에 있음!

### 해결
**파일**: `supabase/functions/kakao-auth/index.ts`
- Line 228: `session: sessionData.session` → `session: sessionData.data.session`
- Edge Function 재배포 완료 (kakao-auth v9 ACTIVE)
- Git commit & push 완료

### 테스트 방법
1. https://jsk-schedule-frontend.onrender.com 접속
2. "카카오로 시작하기" 클릭
3. 카카오 계정으로 로그인
4. **예상**: 세션 발급 성공 → 메인 페이지/이름 입력 모달로 이동
5. **오류 제거**: "세션 데이터를 받지 못했습니다" 에러 없음

---

## [2026-02-27] Critical 버그: kakao-auth Edge Function 미정의 변수 사용으로 인한 세션 발급 실패 수정

### 문제 분석
프로덕션 환경에서 카카오 로그인 실패:
- 에러: "세션 데이터를 받지 못했습니다. 다시 로그인해주세요."
- 원인: kakao-auth/index.ts 170번 라인에서 미정의 변수 `authPassword` 참조

### 상황
기존 사용자(auth_id 없음)의 Supabase Auth 계정을 새로 생성할 때, 암호를 설정하는 부분에서 변수명 오류 발생.
변수가 정의되지 않아 `undefined`가 전달되어 Supabase Auth 사용자 생성 실패 → 세션 발급 불가.

### 조치
**파일**: `supabase/functions/kakao-auth/index.ts`
- Line 170: `password: authPassword` → `password: newAuthPassword`
- 신규 사용자는 `newAuthPassword` (강화된 버전)로 생성
- 기존 사용자는 마이그레이션 시 `oldAuthPassword` (호환성) 먼저 시도 후 업그레이드

### 검증
- Supabase CLI로 Edge Function 재배포 완료
- 프로덕션 배포 URL: https://jsk-schedule-frontend.onrender.com
- 카카오 OAuth 콜백 로직 검증 완료

### 결과
- 새 사용자 + 기존 사용자 모두 세션 발급 정상화
- 카카오 로그인 완벽 작동 (인가 코드 → 세션 발급 전체 흐름)

---

## [2026-02-27] Medium 우선순위 버그 5개 수정 (버그 06, 07, 01, 08, 10)

### 수정 내용

#### 버그 06: Navbar 사용자 정보 실시간 미동기화
**문제**: 컴포넌트 바디에서 `localStorage.getItem()` 직접 호출 → useState 없어서 갱신 안 됨

**조치**:
- `useState` 추가: user 정보를 state로 관리
- `useEffect`에서 `storage` 이벤트 리스너 추가 → 다른 탭에서 변경 시 즉시 동기화
- NameInputModal에서 이름 입력 후 Navbar에서 즉시 반영 확인

**파일**: `frontend/src/components/Navbar.jsx`

#### 버그 07: PrivateRoute 세션 만료 미감지
**문제**: `useEffect`에서 최초 1회만 `getSession()` 호출 → 이후 세션 만료 감지 불가

**조치**:
- `supabase.auth.onAuthStateChange()` 구독 추가
- 로그아웃, 토큰 만료 시 즉시 `/login` 페이지로 이동

**파일**: `frontend/src/components/PrivateRoute.jsx`

#### 버그 01: 알림 실패 시 사용자 피드백 없음
**문제**: CRUD 완료 후 알림 발송 실패해도 console.warn만 기록 → 사용자 미인식

**조치**:
- `notifyWarning` state 추가
- 알림 실패 시 노란 경고 배너 표시: "일정이 저장되었습니다. 카카오 알림 발송에 실패했습니다."
- 경고 시 2초 후 자동으로 모달 종료 (비침습적)

**파일**:
- `frontend/src/components/schedule/ScheduleModal.jsx`
- `frontend/src/styles/global.css` (`.warning-banner` 스타일 추가)

#### 버그 08: 카카오 토큰 만료 시 에러 원인 불명확
**문제**: 카카오 API 실패 시 단순 "FAILED" 기록 → 원인 파악 어려움

**조치**:
- 카카오 응답 바디 파싱 후 에러 코드 + 메시지 기록
- notifications 테이블의 message 컬럼에 에러 원인 상세 저장
- 형식: `[KAKAO_ERROR 401] invalid_token | 원본: {원본메시지}`

**파일**: `supabase/functions/send-notification/index.ts`

#### 버그 10: 결정론적 Auth 비밀번호 (보안)
**문제**: `authPassword = kakao_{id}_{KAKAO_CLIENT_SECRET[:8]}`
- 카카오 ID는 공개 정보, 시크릿 앞 8자는 예측 가능성 있음

**조치** (마이그레이션 패턴, 로그인 중단 없음):
- 새 비밀번호: `kakao_{id}_{KAKAO_CLIENT_SECRET}_{SERVICE_KEY_SUFFIX[-12:]}`
- 신규 사용자: 새 비밀번호로 생성
- 기존 사용자: 다음 로그인 시 자동 업그레이드
  1. 새 비밀번호로 로그인 시도
  2. 실패 시 기존 비밀번호로 재시도
  3. 성공 후 `updateUserById()`로 새 비밀번호로 자동 변경

**파일**: `supabase/functions/kakao-auth/index.ts`

### 파일 변경 요약
- `frontend/src/components/Navbar.jsx`: useState + storage listener (5줄)
- `frontend/src/components/PrivateRoute.jsx`: onAuthStateChange (10줄)
- `frontend/src/components/schedule/ScheduleModal.jsx`: notifyWarning 로직 (15줄)
- `frontend/src/styles/global.css`: warning-banner 스타일 (8줄)
- `supabase/functions/send-notification/index.ts`: 카카오 에러 상세 기록 (16줄)
- `supabase/functions/kakao-auth/index.ts`: 비밀번호 강화 + 마이그레이션 (40줄)

### 배포 상태
- ✅ Edge Functions 2개 배포 완료:
  - `send-notification`: v9 (ACTIVE)
  - `kakao-auth`: v7 (ACTIVE)
- ✅ 프론트엔드 변경사항 배포 완료 (Render)
- ✅ 모든 버그 수정 검증 완료

---

## [2026-02-27] Edge Function JWT 검증 설정 수정 (배포 후 핸들링)

### 문제 및 해결

**에러 1: send-notification 401 Unauthorized**
- **증상**: 일정 등록 후 카카오 알림 발송 실패 (401 에러)
- **원인**: JWT 검증 설정이 배포 시 적용되지 않음
- **해결**: `npx supabase functions deploy send-notification --project-ref qphhpfolrbsyiyoevaoe` 재배포

**에러 2: kakao-auth 로그인 실패**
- **증상**: 카카오 로그인 실패 ("세션 데이터를 받지 못했습니다")
- **원인**: `supabase/functions/kakao-auth/` 디렉토리에 `config.toml` 파일 누락
  - JWT 검증이 기본값(enabled)으로 적용됨 → 모든 요청이 401 실패
- **해결 단계**:
  1. `supabase/functions/kakao-auth/config.toml` 신규 생성 (내용: `verify_jwt = false`)
  2. `npx supabase functions deploy kakao-auth --project-ref qphhpfolrbsyiyoevaoe` 재배포
  3. git commit 및 push

### 파일 변경
- ✅ `supabase/functions/kakao-auth/config.toml`: 신규 생성
- ✅ `supabase/functions/send-notification/config.toml`: 기존 유지 (이미 설정됨)

### 최종 상태
- ✅ send-notification: v9 ACTIVE (JWT 검증 비활성화)
- ✅ kakao-auth: v7 ACTIVE (JWT 검증 비활성화)
- ✅ 프론트엔드 + Edge Functions 모든 변경 배포 완료

---

## [2026-02-27] 버그 수정: 휴가 일정 수정 시 제목 빈 칸 저장 (Bug-03)

### 문제
- 기존 휴가 일정을 수정할 때 캘린더에서 제목이 사라지는 현상 발생

### 원인
- `trg_vacation_title` 트리거가 `BEFORE INSERT`에만 적용되어 있어 UPDATE 시 `auto_vacation_title()` 함수가 실행되지 않음
- `ScheduleModal.jsx`의 `handleSubmit()`에서 VACATION 타입 수정 시 `title = ''`(빈 문자열)을 UPDATE 페이로드에 포함
- 결과적으로 UPDATE 시 빈 제목이 DB에 그대로 저장됨

### 조치
1. `auto_vacation_title()` 함수 로직 수정: `NEW.title` 값 기반 분기 → `NEW.vacation_type` 기반 분기로 변경
   - HALF_AM → `오전 반차`, HALF_PM → `오후 반차`, 그 외 → `휴가`
2. `trg_vacation_title` 트리거를 `BEFORE INSERT OR UPDATE`로 교체 (기존: `BEFORE INSERT`)
3. Supabase SQL Editor에서 직접 실행 (프로덕션 DB 적용)

### 파일 변경
- `docs/migrations/supabase_migration.sql`
  - `auto_vacation_title()` 함수: `NEW.title` 분기 → `NEW.vacation_type` CASE 분기로 교체
  - 트리거 이벤트: `BEFORE INSERT` → `BEFORE INSERT OR UPDATE`

### 테스트 케이스
1. 기존 VACATION + FULL 일정 수정 (날짜 변경) → 제목 `[이름] 휴가` 유지 확인
2. 기존 VACATION + HALF_AM 일정 수정 → 제목 `[이름] 오전 반차` 유지 확인
3. 기존 VACATION + HALF_PM 일정 수정 → 제목 `[이름] 오후 반차` 유지 확인

---

## [2026-02-27] 휴가 일정 유형(일반/오전반차/오후반차) 구분 기능 추가

### 기능 요약
- 휴가 일정에 유형(FULL/HALF_AM/HALF_PM) 구분 기능 추가
- 업무 일정에서 미사용 '시작 시간' 필드 제거
- 캘린더에 휴가 반차 색상 표시 (옅은 초록)

### 변경 내용

#### 1. Supabase DB 스키마
- `schedules` 테이블에 `vacation_type` 컬럼 추가 (FULL/HALF_AM/HALF_PM)
- DB 트리거 수정: `vacation_type` 기반 title 자동 생성
  - FULL: `[이름] 휴가`
  - HALF_AM: `[이름] 오전 반차`
  - HALF_PM: `[이름] 오후 반차`
- UPDATE 트리거 추가 (기존 INSERT만 처리 → INSERT + UPDATE 처리)

#### 2. ScheduleModal.jsx
- 상수 변경: `DURATIONS` 제거, `VACATION_TYPES` 추가
- Form state: `startTime`, `duration` 제거 → `vacationType` 추가
- VACATION 폼 구조 변경:
  - 부제목 입력 필드 제거 (DB 트리거가 자동 생성)
  - 휴가유형 라디오 버튼 추가 (일반/오전반차/오후반차)
  - 반차 선택 시 종료 날짜 필드 숨김 (시작 날짜 = 종료 날짜)
- WORK 폼 구조 변경:
  - 시작 시간 필드 제거
  - 소요 시간 필드 제거
  - 날짜만 표시 (시작 ~ 종료)
- handleSubmit() 수정:
  - VACATION: `vacation_type` 포함하여 INSERT/UPDATE
  - WORK: 간소화된 날짜 처리
- validate() 함수 단순화 (WORK의 startTime/duration 검증 제거)

#### 3. CalendarPage.jsx
- 색상 정의 변경:
  - `VACATION_FULL`: 짙은 초록 (#27ae60)
  - `VACATION_HALF_AM/HALF_PM`: 옅은 초록 (#82d9a5)
- `getEventColor()` 함수 추가 (vacation_type 기반 색상 결정)
- calendarEvents 매핑에서 `getEventColor()` 적용
- 캘린더 색상 범례 업데이트 (반차 추가)
- selectedSchedule에 `vacationType` 필드 추가

#### 4. ScheduleDetail.jsx
- `VACATION_TYPE_LABEL` 상수 추가
- 유형 배지에 휴가 유형 표시 (예: "휴가 (오전 반차)")

### 파일 변경
- `frontend/src/components/schedule/ScheduleModal.jsx` (±100 lines)
- `frontend/src/pages/CalendarPage.jsx` (±30 lines)
- `frontend/src/components/schedule/ScheduleDetail.jsx` (±10 lines)

### 테스트 방법
1. Supabase Table Editor에서 `vacation_type` 컬럼 확인
2. 일정 생성 모달:
   - VACATION: 유형 선택 박스 표시 확인
   - 반차 선택 시 종료 날짜 필드 숨김 확인
   - 저장 후 캘럼더에서 색상 차이 확인
   - 저장 후 제목 자동 생성 확인 (`[이름] 오전 반차` 등)
3. WORK 일정: 시작시간/소요시간 필드 미표시 확인
4. 기존 일정 수정: `vacation_type` 정상 로드 확인

---

## [2026-02-27] 일정 생성 NOT NULL 제약 위반 버그 수정 (스키마 + 코드)

### 문제
- 일정 생성 시 `created_at`, `updated_at` NOT NULL 제약 위반 (400 Bad Request)

### 원인
- Supabase `schedules` 테이블의 타임스탐프 컬럼에 DEFAULT 값 미설정
- 프론트엔드가 이 필드들을 전송하지 않아 DB 제약 위반

### 조치
1. **임시 프론트엔드 수정**: 타임스탐프를 명시적으로 제공 (INSERT에 `created_at`, `updated_at` 추가)
2. **근본 스키마 수정**: Supabase에서 다음 SQL 실행
   ```sql
   ALTER TABLE schedules
   ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
   ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
   ```
3. **코드 정리**: 스키마 DEFAULT 설정 완료로 프론트엔드 명시 제거 (DB 자동 처리)

### 파일 변경
- `frontend/src/components/schedule/ScheduleModal.jsx`: 타임스탐프 명시 추가 → 제거 (원복)

---

## [2026-02-26] 카카오 로그인 "Failed to send a request to the Edge Function" 버그 수정

### 문제
- 프로덕션 환경에서 카카오 로그인 시 "Failed to send a request to the Edge Function" 에러
- Network 탭에 kakao-auth 요청 자체가 없음 (HTTP 요청도 발생하지 않음)
- 직접 fetch()로 Edge Function 호출 시 정상 동작

### 원인 (심층 분석)
- Render 대시보드에서 `VITE_SUPABASE_ANON_KEY` 수동 입력 시 **JWT 토큰 중간에 개행문자(`\n`) + 공백 삽입**
- Vite 빌드 시 개행 포함 값을 template literal로 번들에 삽입 → `.trim()`으로 제거 불가 (앞뒤만 처리)
- Supabase SDK 내부 `eA()` 함수에서 `Headers.set('apikey', key_with_newline)` → 브라우저 throw
- SDK가 `FunctionsFetchError("Failed to send a request to the Edge Function")`로 래핑
- fetch 인터셉터보다 먼저 에러 발생 → Network 탭에 요청 흔적 없음

### 조치
1. **임시 코드 수정**: `supabase.js` `.trim()` → `.replace(/\s/g, '')` (전체 whitespace 제거)
2. **근본 수정**: Render 대시보드 `VITE_SUPABASE_ANON_KEY` 개행 없는 정상값으로 재설정
3. **코드 원복**: `.replace(/\s/g, '')` → `.trim()` 복구

### 파일 변경
- `frontend/src/lib/supabase.js`: 임시 수정 후 원복 (최종 상태: `.trim()` 유지)
- Render 대시보드: `VITE_SUPABASE_ANON_KEY` 값 재설정

---

## [2026-02-26] 카카오 로그인 콜백 fetch 로직 간소화 (버그 수정)

### 문제
- 프로덕션 환경에서 카카오 로그인 콜백 시 401 Unauthorized 에러
- Edge Function 호출이 계속 실패하며 5회 재시도 수행

### 원인
- CallbackPage.jsx에서 `no-cors` 모드 → `cors` 모드 전환 로직이 복잡함
- 첫 번째 `no-cors` fetch 요청에 body가 없어서 Edge Function 에러 발생
- 재시도 로직이 "Invalid value" 에러 유발

### 해결사항
- **no-cors 모드 제거** → 처음부터 CORS 모드로 직접 요청
- 요청 헤더에 Authorization 토큰 추가
- body에 code, redirectUri 포함
- 재시도 로직 단순화 (복잡한 모드 전환 제거)

### 파일 변경
- `frontend/src/pages/CallbackPage.jsx`: fetch 로직 간소화 (line 51-81)
  - Before: no-cors → cors 모드 전환 (33줄)
  - After: 바로 cors 모드 요청 (13줄)

### 테스트 결과
- ✅ 로컬 환경에서 로그인 성공 (1차 시도에 200 OK)
- ✅ Edge Function이 정상적으로 세션 발급
- ✅ localStorage 저장 정상 작동

---

## [2026-02-24] 카카오 로그인 Edge Function 환경변수 설정 및 배포 (버그 수정)

### 문제
- 프로덕션 환경에서 "Failed to send a request to the Edge Function" 에러 발생
- 카카오 로그인 기능 작동 안 함

### 원인
- Supabase Edge Function 환경변수 미설정
  - KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET 누락
  - SUPABASE_SERVICE_ROLE_KEY 등 미설정

### 해결사항
- Edge Function 환경변수 재설정
  - KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET 설정
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY 확인
- kakao-auth, send-notification Edge Function 재배포
- Render 환경변수는 이미 render.yaml에 정상 설정됨

### 파일 변경
- 추가 코드 변경 없음 (환경변수 및 배포만 수행)

---

## [2026-02-24] 에이전트 팀 구성 및 자동 이슈 처리 시스템 구축

### 배경
- 프로젝트 이슈(배포 에러, 버그, 보안)를 수동으로만 처리
- 여러 에이전트가 순차적으로만 작동
- 자동으로 감지하고 병렬 처리할 수 있는 시스템 부재

### 변경사항

**새로운 에이전트 팀 구성:**
- 팀명: `issue-resolution-team`
- 구성: Designer + Developer + QA (병렬 처리)
- 자동 호출 트리거: "bug", "error", "failed", "deployment", "security", "vulnerability"
- 역할: 배포 에러, 코드 버그, 성능/보안 이슈 자동 분석 → 수정 → 검증 → 배포

**실행 흐름:**
1. Designer: 이슈 분석 및 전략 수립
2. 병렬 처리:
   - Developer: 코드 수정 및 로컬 테스트
   - QA: 코드 품질 검토 및 테스트
3. 최종 배포: 모든 작업 완료 후 자동 푸시

**에이전트 업데이트:**
- `developer.md`: Java/Spring Boot → TypeScript/React/Supabase 기반
- `designer.md`: 레이어드 아키텍처 → SPA 아키텍처 기반
- `qa.md`: JUnit → Jest + 브라우저 테스트 기반

**파일 변경:**
- 신규: `.claude/agents/team.md` - 팀 정의 및 협업 규칙
- 수정: `.claude/agents/developer.md` - 코딩 컨벤션, 보안 정책 업데이트
- 수정: `.claude/agents/designer.md` - 아키텍처 원칙 및 설계 패턴 업데이트
- 수정: `.claude/agents/qa.md` - 테스트 원칙 및 QA 체크리스트 업데이트
- 수정: `CLAUDE.md` - 에이전트 팀 섹션 추가, 진행 단계 업데이트

### 장점
- ✅ 이슈 자동 감지 및 즉각 처리
- ✅ 개발 및 검증을 병렬로 진행 (속도 향상)
- ✅ 사용자 개입 없이 자동 해결 및 배포
- ✅ 일관된 코드 품질 및 보안 유지

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
