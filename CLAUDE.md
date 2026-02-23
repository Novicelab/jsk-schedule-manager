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
- 사용자 인증은 Supabase Auth + 카카오 OAuth를 통해 관리한다.

---

## 기술 스택

| 구분 | 항목 | 비고 |
|------|------|------|
| 언어 | JavaScript / TypeScript | 단일 언어 스택 |
| 프론트엔드 | React + Vite | FullCalendar, Tailwind CSS, react-datepicker |
| BaaS | Supabase | Auth, PostgreSQL, RLS, Edge Functions |
| 데이터베이스 | Supabase PostgreSQL | RLS(Row Level Security), PgBouncer 커넥션 풀링 |
| 서버리스 함수 | Supabase Edge Functions (Deno) | 카카오 OAuth, 알림톡 발송 |
| 날짜 처리 | dayjs | ISO 8601 형식, 타임존 안전성 |
| 스타일링 | Tailwind CSS | 유틸리티 기반 CSS, 빠른 프로토타이핑 |
| 빌드 도구 | Vite | |
| 배포 플랫폼 | Render (Static Site) | 클라우드 앱 호스팅 플랫폼 (Singapore 리전) |
| 배포 구성 | Static Site (Frontend Only) | 자동 배포 (GitHub 연동) |
| 배포 URL | Frontend: https://jsk-schedule-frontend.onrender.com | Live |
| 소스관리/CI·CD | GitHub | 코드 버전관리 및 자동 배포 연동 |
| 인증 | 카카오톡 OAuth 2.0 + Supabase Auth | 세션 자동 갱신 (Supabase Client 내장) |
| 알림 | 카카오톡 알림톡 API | Supabase Edge Function에서 비동기 처리 |

---

## 아키텍처

```
[React SPA (Static Site)] ←→ [Supabase Client]
                                ├── PostgreSQL + RLS (CRUD 직접 접근)
                                ├── Auth (세션 관리, 토큰 자동 갱신)
                                └── Edge Functions
                                    ├── kakao-auth (카카오 OAuth 처리)
                                    └── send-notification (알림톡 발송)
```

- **프론트엔드**: React SPA → Supabase JS Client로 DB 직접 접근
- **인증**: Supabase Auth (카카오 OAuth는 Edge Function 경유)
- **보안**: RLS(Row Level Security)로 행 수준 접근 제어
- **알림**: Edge Function에서 카카오 알림톡 API 호출
- **DB 트리거**: VACATION 일정 제목 자동 생성 (`[이름] 부제목`)

---

## 개발 정책

### 코드 컨벤션
- JavaScript/TypeScript 표준 네이밍 컨벤션을 따른다 (함수/변수: camelCase, 컴포넌트: PascalCase).
- React 컴포넌트는 기능별로 분리한다 (pages / components / hooks / lib).
- 메서드는 단일 책임 원칙(SRP)을 준수한다.
- 주석은 로직이 명확하지 않은 경우에만 작성한다.

### 보안 정책
- Supabase RLS로 인증되지 않은 사용자의 데이터 접근을 차단한다.
- SQL Injection, XSS 등 OWASP Top 10 취약점을 반드시 방어한다.
- 민감 정보(API 키, 시크릿 등)는 코드에 하드코딩하지 않는다.
- Supabase Anon Key는 공개 가능하나, Service Role Key는 Edge Functions에서만 사용한다.

### 테스트 정책
- 프론트엔드 컴포넌트는 필요 시 단위 테스트를 작성한다.
- Edge Functions는 로컬 Supabase CLI로 테스트한다.
- RLS 정책은 Supabase Dashboard에서 검증한다.

---

## 프로젝트 진행 단계

- [x] 기획: 서비스 컨셉 및 주요 정책 정의 → [기획서](docs/planning/service-planning.md)
- [x] 설계: 시스템 아키텍처 및 데이터 모델 설계 → [설계서](docs/design/system-design.md)
- [x] 개발 v1: Spring Boot + React 구현 (총 91개 파일)
- [x] 테스트 v1: QA 7개 버그 수정, JUnit 47개 케이스
- [x] 배포 v1: Render (Backend Docker + Frontend Static)
- [x] 유지보수: 카카오 로그인, UI/UX, CORS 등 개선 (상세 → CHANGELOG.md)
- [x] 구조 전환 (2026-02-23): Spring Boot → Supabase 중심 구조
  - ✅ Spring Boot 백엔드 완전 제거 (Java 64개 파일)
  - ✅ Supabase Edge Functions 생성 (kakao-auth, send-notification)
  - ✅ RLS 정책 + DB 트리거 마이그레이션 SQL 작성
  - ✅ 프론트엔드 Axios → Supabase Client 전환 (12개 파일)
  - ✅ Render 2개 서비스 → 1개 Static Site 축소
  - ✅ Docker, Gradle, Spring 관련 파일 전체 삭제

---

## 스킬 & 에이전트 사용 가이드

### 슬래시 명령어 (수동 호출)

| 명령어 | 용도 |
|--------|------|
| `/plan` | 기능 기획, 요구사항 분석, 사용자 스토리 작성 |
| `/design` | 아키텍처, 데이터 모델, 클래스 설계 |
| `/dev` | 코드 구현 및 리뷰 |
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

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

**특징:**
- 포트: 5173
- 자동 핫 리로드 (Vite)
- Supabase에 직접 연결 (백엔드 불필요)

### 환경 변수 설정

**프론트엔드 (frontend/.env 파일)**
```env
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_SUPABASE_URL=https://qphhpfolrbsyiyoevaoe.supabase.co
VITE_SUPABASE_ANON_KEY=[Supabase Anon Key]
```

템플릿: `frontend/.env.example` 참고

**Supabase Edge Functions 환경변수 (Supabase Dashboard에서 설정)**
```
KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[카카오 시크릿]
SUPABASE_URL=https://qphhpfolrbsyiyoevaoe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[Supabase Service Role Key]
SUPABASE_ANON_KEY=[Supabase Anon Key]
```

### Supabase Edge Functions 배포

```bash
# Supabase CLI 설치 (최초 1회)
npm install -g supabase

# 로그인
supabase login

# Edge Functions 배포
supabase functions deploy kakao-auth --project-ref qphhpfolrbsyiyoevaoe
supabase functions deploy send-notification --project-ref qphhpfolrbsyiyoevaoe
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
