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
- [x] 에이전트 팀 구성 (2026-02-24): 자동 이슈 처리 시스템
  - ✅ issue-resolution-team 생성 (Designer + Developer + QA 병렬)
  - ✅ 에이전트 업데이트 (TypeScript/React/Supabase 기반)
  - ✅ 자동 호출 트리거 설정 (버그, 에러, 배포, 보안 키워드)
- [x] 사용자 경험 개선 (2026-03-01): 로딩 팝업 추가
  - ✅ LoadingPopup 재사용 가능 컴포넌트 생성
  - ✅ Dimmed 배경 (rgba(0,0,0,0.5)) + 애니메이션 스피너 UI
  - ✅ 비동기 작업 전반 적용 (로그인, 세션 확인, 일정 CRUD, 이름 저장)
  - ✅ 프론트엔드 자동 배포 완료
- [x] RLS 정책 및 세션 관리 개선 (2026-03-01): 신규 사용자 이름 저장 에러 해결
  - ✅ update-user-name Edge Function 생성 (Service Role로 RLS 우회)
  - ✅ NameInputModal 세션 검증 및 Edge Function 통합
  - ✅ CallbackPage 세션 로드 검증 (최대 5초 대기)
  - ✅ kakao-auth 디버깅 로깅 강화
  - ✅ Edge Function 배포 완료 (qphhpfolrbsyiyoevaoe)
  - ✅ 전체 흐름 git commit & push 완료

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
| `designer` | opus | 설계, 아키텍처, ERD, 컴포넌트 다이어그램, API 설계 |
| `developer` | sonnet | 구현, 코드 작성, 개발, 버그 수정, 리팩토링 |
| `qa` | sonnet | 테스트, QA, 버그, 테스트 케이스, 품질 검토 |

### 에이전트 팀 (자동 이슈 처리)

여러 에이전트가 협력하여 자동으로 이슈를 처리하는 팀 구성입니다.

| 팀 이름 | 구성 | 자동 호출 키워드 | 역할 |
|--------|------|-----------------|------|
| `issue-resolution-team` | Designer + Developer + QA (병렬) | "bug", "error", "failed", "deployment", "security", "vulnerability" | 배포 에러, 코드 버그, 성능/보안 이슈 자동 처리 및 배포 |

**실행 흐름**: Designer 분석 → (Developer 수정 \|\| QA 검토) → 자동 배포

---

## 로컬 개발 환경 설정

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

**특징:**
- 포트: 5173 (고정)
- 자동 핫 리로드 (Vite)
- Supabase에 직접 연결 (백엔드 불필요)

### 로컬 서버 재시작 가이드

**중요**: 환경 변수 또는 Edge Function 설정 변경 후에는 **항상 로컬 서버를 재시작**해야 변경사항이 반영됩니다.

#### 절차
1. **기존 서버 종료** (자동 강제 종료)
   ```bash
   # 포트 5173을 사용하는 프로세스를 자동으로 찾아 종료
   lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9
   ```

2. **새 서버 시작**
   ```bash
   cd frontend
   npm run dev
   ```

3. **포트 5173 고정**
   - Vite가 5173에서 시작하지 못하면 5174, 5175... 로 포트 변경
   - **항상 같은 포트(5173)에서 테스트하기 위해 위의 자동 종료 프로세스 필수**
   - 환경 변수에 설정된 `VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback` 과 일치해야 함

#### 브라우저 캐시 초기화 (필요 시)
```javascript
// 개발자 도구 (F12) → Application → Storage
// localStorage와 Cache Storage 전체 삭제
localStorage.clear()
```

#### 빠른 재시작 명령어 (한 줄)
```bash
lsof -i :5173 2>/dev/null | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null; sleep 1; cd frontend && npm run dev
```

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

### 환경변수 관리 정책 ⚠️ 재발 방지

> **주의**: Render 대시보드에서 직접 환경변수를 수정하면 `render.yaml` 값을 override하며,
> 붙여넣기 과정에서 개행문자가 삽입될 수 있습니다.
> 이 경우 Supabase SDK 헤더 오류(`Failed to send a request to the Edge Function`)를 유발합니다.

**핵심 원칙: `render.yaml`이 단일 소스(Single Source of Truth)**

| 상황 | 올바른 방법 |
|------|-----------|
| 환경변수 추가/수정 | `render.yaml` 수정 → `git push` → 자동 배포 |
| 대시보드 직접 수정 불가피한 경우 | 텍스트 에디터에서 값 확인 후 **한 줄로** 붙여넣기 |
| JWT 등 긴 문자열 입력 시 | 개행문자 포함 여부 반드시 확인 |

**배포 후 스모크 테스트 (필수 확인)**
- `VITE_*` 환경변수 변경 후 반드시 **카카오 로그인** 동작 확인
- Network 탭에서 `kakao-auth` 요청 발생 여부 확인

---

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

## 외부 서비스 연동 - CLI 확인 & 작업 가이드

**원칙**: 작업 수행 전 항상 CLI 설치, 로그인, 환경변수 상태를 확인하고, **가능할 경우 직접 실행**합니다.

### 1. Supabase CLI 확인 및 작업

**설치 확인**
```bash
supabase --version
# supabase-cli 1.x.x 이상이면 OK
```

**로그인 상태 확인**
```bash
supabase projects list
# 프로젝트 목록 나타나면 인증 완료
```

**프로젝트 연결 확인**
```bash
# 현재 작업 디렉토리에 supabase 설정이 있는지 확인
cat supabase/.env.local  # 로컬 환경변수 확인
```

**직접 실행할 수 있는 작업**
| 작업 | 명령어 |
|------|--------|
| Edge Functions 배포 | `supabase functions deploy [함수명] --project-ref qphhpfolrbsyiyoevaoe` |
| 마이그레이션 실행 | `supabase db push` (로컬에서) |
| 환경변수 조회 | `supabase secrets list --project-ref qphhpfolrbsyiyoevaoe` |
| 환경변수 설정 | `supabase secrets set KEY=VALUE --project-ref qphhpfolrbsyiyoevaoe` |
| 함수 로그 조회 | `supabase functions get-logs kakao-auth --project-ref qphhpfolrbsyiyoevaoe` |

**판단 기준**
- ✅ 직접 실행: CLI 설치 및 로그인 완료 + 프로젝트 ref 확인됨
- ❌ 수동 작업: Dashboard에서만 가능한 작업 (RLS 정책, 테이블 구조 변경 등)

---

### 2. Render API 확인 및 작업

**API 토큰 확인**
```bash
# Render Dashboard → Account Settings → API Tokens
# env에 설정되어 있는지 확인
echo $RENDER_API_TOKEN
```

**배포 상태 확인**
```bash
# curl로 마지막 배포 상태 조회
curl -s -H "Authorization: Bearer $RENDER_API_TOKEN" \
  https://api.render.com/v1/services/jsk-schedule-frontend/latest-deployment | jq '.status'
# SUCCEEDED, IN_PROGRESS, FAILED 중 하나
```

**환경변수 확인 (render.yaml 기준)**
```bash
# render.yaml의 env 섹션 확인
cat render.yaml | grep -A 20 "env:"
```

**직접 실행할 수 있는 작업**
| 작업 | 방법 |
|------|------|
| 배포 상태 조회 | Render Dashboard 또는 위의 curl 명령 |
| 환경변수 수정 | `render.yaml` 파일 수정 → `git push` (자동 배포) |
| 수동 배포 트리거 | Render Dashboard (CLI 없음) |
| 로그 조회 | Render Dashboard |

**판단 기준**
- ✅ 직접 실행: `render.yaml` 수정 가능 (로컬 파일) → git push
- ✅ 직접 실행: 배포 상태 조회 가능 (API 토큰 있을 때)
- ❌ 수동 작업: 수동 배포, 리소스 변경 등 (Dashboard 필수)

---

### 3. GitHub CLI 확인 및 작업

**설치 확인**
```bash
gh --version
# gh version X.X.X (2024년 이후 버전 권장)
```

**로그인 상태 확인**
```bash
gh auth status
# Logged in to github.com as [username]
```

**Repository 권한 확인**
```bash
gh repo view --json nameWithOwner,owner,isPrivate
# 푸시 권한 있는지 확인
```

**직접 실행할 수 있는 작업**
| 작업 | 명령어 |
|------|--------|
| Commit & Push | `git commit -m "..."` → `git push` |
| PR 생성 | `gh pr create --title "..." --body "..."` |
| Issue 조회 | `gh issue list` |
| PR 상태 확인 | `gh pr view [PR-Number]` |
| 배포 상태 조회 | `gh run list --limit 5` (Actions) |

**판단 기준**
- ✅ 직접 실행: `git push` 권한 확인 완료
- ✅ 직접 실행: PR/Issue 조회, 생성 가능
- ❌ 수동 작업: PR Merge, Branch 보호 설정 등 (권한 필요)

---

### 4. Kakao API 확인 및 작업

**클라이언트 ID 확인**
```bash
# 환경변수에서 확인
echo $VITE_KAKAO_CLIENT_ID
# 240f33554023d9ab4957b2d638fb0d71 (프론트엔드)

echo $KAKAO_CLIENT_ID
# Supabase Edge Functions 환경변수에서 설정
```

**OAuth 설정 확인**
```bash
# Kakao Developers Console → [앱 이름] → 플랫폼
# 리다이렉트 URI: http://localhost:5173/auth/callback (로컬)
#             https://jsk-schedule-frontend.onrender.com/auth/callback (배포)
```

**알림톡 권한 확인**
```bash
# Kakao Developers Console → [앱 이름] → 제품
# 비즈니스 앱 (구: 플러스친구) → 알림톡 권한 활성화 여부 확인
```

**직접 실행할 수 있는 작업**
| 작업 | 방법 |
|------|------|
| OAuth 테스트 | 로컬에서 로그인 시도 (localhost:5173) |
| 알림톡 발송 테스트 | `send-notification` Edge Function 호출 |
| 환경변수 검증 | Supabase Dashboard → Edge Functions → 환경변수 |

**판단 기준**
- ✅ 직접 실행: OAuth/알림톡 로그 확인 (Edge Function 로그)
- ❌ 수동 작업: Kakao Developers 콘솔 설정 변경 (권한 필수)

---

### 5. 통합 확인 플로우 (작업 시작 전 필수)

매 작업마다 아래 체크리스트 확인:

```bash
#!/bin/bash
echo "=== 외부 서비스 CLI 확인 ==="

# 1. Supabase
echo "1. Supabase CLI:"
supabase projects list > /dev/null 2>&1 && echo "  ✅ 로그인됨" || echo "  ❌ 미로그인 (supabase login 필요)"

# 2. GitHub
echo "2. GitHub CLI:"
gh auth status | grep -q "Logged in" && echo "  ✅ 로그인됨" || echo "  ❌ 미로그인 (gh auth login 필요)"

# 3. 환경변수 (로컬)
echo "3. 환경변수:"
[ -f frontend/.env ] && echo "  ✅ frontend/.env 있음" || echo "  ❌ frontend/.env 없음"
[ -f supabase/.env.local ] && echo "  ✅ supabase/.env.local 있음" || echo "  ❌ supabase/.env.local 없음"

# 4. Node 버전
echo "4. Node.js:"
node --version && npm --version
```

**직접 작업 가능 판단 기준**
- [ ] Supabase CLI 로그인됨
- [ ] GitHub CLI 로그인됨 (푸시 작업 필요 시)
- [ ] 환경변수 파일 존재
- [ ] Node.js 18+ 설치됨

모두 확인되면 ✅ **직접 작업 실행 가능**

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
