# JSK 일정 관리 서비스 - 프로젝트 가이드

## 서비스 컨셉

**JSK 일정 관리**는 팀/그룹 단위의 일정을 공유하고 협업할 수 있는 웹 기반 일정 관리 서비스입니다.
개인이 아닌 **팀 중심의 일정 관리**를 핵심 가치로 하며, 팀원 간 일정 가시성 확보와 효율적인 협업을 목표로 합니다.

---

## 핵심 기능

| 기능 | 설명 |
|------|------|
| 일정 CRUD | 일정 생성, 조회, 수정, 삭제 |
| 팀원 초대/권한 관리 | 팀 구성원 관리 및 역할(관리자/일반) 분리 |
| 알림/리마인더 | 일정 전 알림 및 마감 리마인더 발송 |
| 캘린더 뷰 | 월간/주간/일간 캘린더 형태의 시각화 |

---

## 주요 정책

### 사용자 및 권한 정책
- 팀은 **관리자(Admin)** 와 **일반 멤버(Member)** 두 가지 역할로 구분한다.
- 관리자: 팀 생성, 팀원 초대/추방, 팀 설정 변경, 모든 일정 수정/삭제 가능
- 일반 멤버: 본인이 생성한 일정만 수정/삭제 가능, 팀 일정 조회 가능
- 팀에 속하지 않은 사용자도 타 팀의 일정을 조회할 수 있다.

### 일정 정책
- 일정은 **개인의 휴가**와 **팀 일정**으로 구분한다.
- 일정이 등록되면 해당되는 팀 내 구성원에게 모두 알림이 발송된다.
- 일정에는 제목, 날짜/시간, 설명을 포함한다.
- 과거 일정은 삭제하지 않고 아카이브 처리한다.

### 알림 정책
- 알림은 CRUD가 발생할 때마다 발송된다. (즉, 일정의 등록, 수정, 삭제 시 알림 발송)
- 알림 채널은 카카오톡을 기준으로 한다.

### 데이터 정책
- 모든 데이터는 데이터베이스(DB)에 영구 저장한다.
- 삭제된 일정은 소프트 딜리트(soft delete) 방식으로 처리한다 (물리 삭제 금지).
- 사용자 비밀번호는 반드시 암호화하여 저장한다 (BCrypt 사용).

---

## 기술 스택

| 구분 | 항목 | 비고 |
|------|------|------|
| 언어 | Java | |
| 백엔드 | Spring Boot | Spring Data JPA, Spring Security |
| 프론트엔드 | React + Vite | FullCalendar, Tailwind CSS, react-datepicker |
| 날짜 처리 | dayjs | ISO 8601 형식, 타임존 안전성 |
| 스타일링 | Tailwind CSS | 유틸리티 기반 CSS, 빠른 프로토타이핑 |
| 데이터베이스 | Supabase (PostgreSQL) | 프로덕션: BaaS, 클라우드 관리형 DB, PgBouncer 커넥션 풀링 |
| 로컬 개발 DB | H2 In-Memory Database | 로컬 개발/테스트 환경용, Gradle 의존성 추가 |
| 빌드 도구 | Gradle | |
| 배포 플랫폼 | Render | 클라우드 앱 호스팅 플랫폼 (Singapore 리전) |
| 배포 구성 | Docker (Backend) + Static Site (Frontend) | 자동 배포 (GitHub 연동) |
| 배포 URL | Backend: https://jsk-schedule-backend.onrender.com<br/>Frontend: https://jsk-schedule-frontend.onrender.com | Live |
| 소스관리/CI·CD | GitHub | 코드 버전관리 및 자동 배포 연동 |
| 인증 | 카카오톡 OAuth 2.0 + JWT | Access Token + Refresh Token (30일) |
| 알림 | 카카오톡 알림톡 API | 비동기 처리 (@Async) |

---

## 개발 정책

### 코드 컨벤션
- Java 표준 네이밍 컨벤션을 따른다 (클래스: PascalCase, 메서드/변수: camelCase).
- 패키지 구조는 레이어드 아키텍처 기준으로 분리한다 (controller / service / repository / domain).
- 메서드는 단일 책임 원칙(SRP)을 준수한다.
- 주석은 로직이 명확하지 않은 경우에만 작성한다.

### 보안 정책
- 인증되지 않은 사용자의 API 접근을 차단한다.
- SQL Injection, XSS 등 OWASP Top 10 취약점을 반드시 방어한다.
- 민감 정보(비밀번호, API 키 등)는 코드에 하드코딩하지 않는다.

### 테스트 정책
- 핵심 비즈니스 로직은 단위 테스트(JUnit 5)를 작성한다.
- 테스트는 AAA 패턴(Arrange / Act / Assert)을 따른다.
- 테스트 메서드명은 `메서드명_상황_기대결과` 형식으로 작성한다.

---

## 프로젝트 진행 단계

- [x] 기획: 서비스 컨셉 및 주요 정책 정의 → [기획서](docs/planning/service-planning.md)
- [x] 설계: 시스템 아키텍처 및 데이터 모델 설계 → [설계서](docs/design/system-design.md)
- [x] 개발: 기능 구현 (백엔드 62개 파일 + 프론트엔드 14개 파일 + 공통 15개 파일 = 총 91개)
- [x] 테스트: QA 및 버그 수정 완료
  - QA 종합 검토: 7개 버그 발견 및 전체 수정 완료
  - JUnit 5 테스트 코드: 47개 테스트 케이스 작성 및 저장 완료
  - 정합성 검증: 100% 통과 (모든 테스트 구현 코드와 일치)
- [x] 배포: 서비스 배포 (Render 완료)
  - 백엔드: Spring Boot Docker (prod 프로파일) → https://jsk-schedule-backend.onrender.com
  - 프론트엔드: React Static Site → https://jsk-schedule-frontend.onrender.com
  - 데이터베이스: Supabase PostgreSQL (PgBouncer 커넥션 풀링)
  - 배포 상태: ✅ Live and Operational
- [x] 유지보수 & 개선: 카카오 로그인 버그 수정 (2026-02-21)
  - ✅ KAKAO_CLIENT_ID 수정: 앱 번호(1389155) → REST API 키(240f33554023d9ab4957b2d638fb0d71)
  - ✅ nickname null 처리: 카카오 프로필 미동의 시 기본값(카카오유저_{kakaoId}) 대체
  - ✅ 카카오 로그인 정상화: KOE101 에러 + DB NOT NULL 제약 위반 500 에러 해결
- [x] 유지보수 & 개선: 일정 생성 UI/UX 개선 및 버그 수정 (2026-02-20)
  - ✅ 날짜 오프셋 버그 해결 (toISOString 제거, 타임존 안전 포맷 사용)
  - ✅ 일정 생성 모달 개선: 스카이스캐너 방식의 날짜 범위 선택 (react-datepicker)
  - ✅ 유형별 UI 분기: 팀 일정(시간 포함) vs 휴가(날짜만)
  - ✅ CalendarPage 보안 강화: teamId null 체크 추가
- [x] 유지보수 & 개선: 카카오 신규 가입 시 이름 입력 팝업 + 휴가 말머리 자동 추가 (2026-02-21)
  - ✅ 신규/기존 사용자 구분: `LoginResponse.isNewUser` 필드 추가
  - ✅ 신규 가입 처리: 카카오 닉네임 대신 임시값(`__PENDING__`) 저장 → 팝업에서 실제 이름 입력
  - ✅ 이름 입력 팝업: `NameInputModal` 컴포넌트 신규 생성 (필수 입력, ESC 닫기 불가)
  - ✅ VACATION 말머리 자동 추가: `[사용자이름] 제목` 형식으로 백엔드에서 자동 추가
  - ✅ WORK 일정 구분: 업무 일정은 원본 제목 그대로 저장
  - ✅ UI/UX 개선: ScheduleModal에서 VACATION 선택 시 placeholder 힌트 표시
- [x] 유지보수 & 개선: CORS 설정 강화 및 신규 회원가입 이름 팝업 수정 (2026-02-22)
  - 상세 이력은 CHANGELOG.md 참고

---

## 스킬 & 에이전트 사용 가이드

### 슬래시 명령어 (수동 호출)

| 명령어 | 용도 |
|--------|------|
| `/plan` | 기능 기획, 요구사항 분석, 사용자 스토리 작성 |
| `/design` | 아키텍처, 데이터 모델, 클래스 설계 |
| `/dev` | Java 코드 구현 및 리뷰 |
| `/qa` | 테스트 케이스 작성 및 QA |

### 서브에이전트 (자동 호출)

`.claude/agents/` 디렉토리에 정의된 에이전트로, 대화 내용에 따라 Claude가 자동으로 호출합니다.

| 에이전트 | 모델 | 자동 호출 키워드 |
|----------|------|-----------------|
| `planner` | opus | 기획, 요구사항, 사용자 스토리, 기능 정의 |
| `designer` | opus | 설계, 아키텍처, ERD, 클래스 다이어그램, API 설계 |
| `developer` | sonnet | 구현, 코드 작성, 개발, 버그 수정, 리팩토링 |
| `qa` | sonnet | 테스트, QA, 버그, 테스트 케이스, 품질 검토 |

---

## 로컬 개발 환경 설정

### 백엔드 실행

```bash
cd "C:\AI Project\JSK_schedule manager"
SPRING_PROFILES_ACTIVE=local java -jar build/libs/jsk-schedule-manager-0.0.1-SNAPSHOT.jar
```

또는 Gradle 빌드 후 실행:
```bash
./gradlew bootRun -Pargs='--spring.profiles.active=local'
```

**특징:**
- 포트: 9090
- 데이터베이스: H2 In-Memory (자동 생성)
- 프로파일 설정: `application-local.yml`
- H2 콘솔: http://localhost:9090/h2-console

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

**특징:**
- 포트: 3001 (또는 사용 가능한 포트)
- 자동 핫 리로드 (Vite)
- API Base URL: http://localhost:9090

### 환경 변수 설정

**백엔드 (.env 파일)**
```env
# Supabase 데이터베이스
SUPABASE_DB_USERNAME=postgres
SUPABASE_DB_PASSWORD=[Supabase 비밀번호]

# Supabase CLI/Management API
SUPABASE_ACCESS_TOKEN=sbp_bfa8be4b663f543b79aa2581ff6c0fd32ad1af48

# JWT 인증
JWT_SECRET=kT9mQ2vN7xL5pR8yJ3wH6bD0cF4eG1sA

# 카카오 OAuth
KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[카카오 시크릿]
KAKAO_REDIRECT_URI=http://localhost:3001/auth/callback
```

**프론트엔드 (frontend/.env 파일)**
```env
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=http://localhost:3001/auth/callback
VITE_API_BASE_URL=http://localhost:9090
```

템플릿: `frontend/.env.example` 참고

### 서비스 상태 확인

```bash
./test_api.sh
```

**출력 예시:**
```
============================================
🔍 로컬 개발환경 테스트
============================================

1️⃣ 백엔드 (포트 8081)
─────────────────────────
상태: ✅ 정상 (Running)

2️⃣ 프론트엔드 (포트 3001)
─────────────────────────
상태: ✅ 정상 (Running)

============================================
```

---

# 개발 프로세스

## 워크플로우

모든 작업은 다음의 프로세스를 따릅니다:

```
1. 로컬 개발 및 테스트
   ↓
2. 모든 절차 완료 확인
   (코드 작성, 로컬 테스트, 검증)
   ↓
3. Git 커밋 & 푸시
   (자동 배포 트리거)
   ↓
4. 문서 업데이트 (필요 시)
   (CLAUDE.md 및 관련 md 파일)
   ↓
5. 반영 완료
```

## 작업 요청 방식

**예시:**
```
[기능명/버그명] 요청
→ 로컬에서 개발/테스트 완료
→ 완료 보고
→ 커밋 & 문서 업데이트
→ 배포 완료
```

## 체크리스트

각 작업 완료 시:
- [ ] 로컬 개발 완료
- [ ] 로컬 테스트 통과
- [ ] 코드 검증 완료
- [ ] git commit (명확한 메시지)
- [ ] 문서 업데이트 (필요 시)
- [ ] git push (자동 배포)

---

# claude.md 파일 관리 규칙

## 정책
1. task 완료 후, 커밋 하기 전에 claude.md 파일 업데이트 필요 여부 판단
   1.1. 필요 판단 시, claude.md 파일 업데이트 (단, 나에게 before / after 비교표 보여주고, 컨펌 후 업데이트 할 것)
2. 그 다음, claude.md 외에 관련된 md 파일의 업데이트 필요 여부 판단
   2.1. 필요 판단 시, 해당되는 파일 업데이트 (단, 나에게 before / after 비교표 보여주고, 컨펌 후 업데이트 할 것)
