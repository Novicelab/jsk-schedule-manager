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
| 알림/리마인더 | 일정 CRUD 발생 시 웹 푸시 발송 (작성자 본인 제외) |
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
- 알림 채널은 **웹 푸시(Web Push API + VAPID)** 를 기준으로 한다. (카카오 알림톡은 미채택)
- 일정 등록/수정/삭제 시 발송하며, **작성자 본인은 제외**한다. 제외 판단은 클라이언트 입력이 아니라 서버가 JWT에서 도출한 사용자로 확정한다.
- 알림 권한은 **Origin 단위**로 부여된다. 스킴·호스트·포트가 하나라도 다르면 별개이며, 타 서비스와 공유되지 않는다.
  - **배포 도메인을 변경하면 전원의 권한·구독이 무효화**되므로 도메인 변경은 신중히 결정한다.
- 구독은 **(사용자 x 기기 x 브라우저)마다 별도**로 생성되므로 `push_subscriptions` 테이블에 1:N으로 저장한다.
- 푸시 서비스가 404/410을 반환하면 만료된 구독이므로 DB에서 삭제한다.
- iOS는 홈 화면에 추가한 PWA 상태에서만 수신 가능하다 (iOS 16.4+).
- 사용자별 알림 on/off는 `notification_preferences`를 따르며, 행이 없으면 기본값 ON으로 간주한다.

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
| 알림 | 웹 푸시 (Web Push API + VAPID) | 발송 비용 0원, 사업자등록증·전화번호 불필요 |
| 알림 암호화 | RFC 8291(aes128gcm) + RFC 8292(VAPID) | `_shared/webpush.ts`에 WebCrypto로 직접 구현 (무의존성) |
| PWA | manifest + Service Worker | iOS 푸시 수신 전제 조건 (홈 화면 추가) |

---

## 아키텍처

```
[React SPA (Static Site)] ←→ [Supabase Client]
                                ├── PostgreSQL + RLS (CRUD 직접 접근)
                                ├── Auth (세션 관리, 토큰 자동 갱신)
                                └── Edge Functions
                                    ├── kakao-auth (카카오 OAuth 처리)
                                    ├── send-notification (웹 푸시 발송, 작성자 제외 + 만료 구독 정리)
                                    ├── save-push-subscription (푸시 구독 저장/해제, RLS 우회)
                                    ├── update-user-name (사용자 이름 저장, RLS 우회)
                                    ├── delete-user (회원 탈퇴, 민감정보 삭제)
                                    ├── soft-delete-schedule (일정 soft delete, RLS 우회)
                                    └── update-schedule (일정 생성/수정, 서버사이드 소유권 검증)

[브라우저] Service Worker (/sw.js) ← 푸시 수신 → OS 알림 센터
```

- **프론트엔드**: React SPA → Supabase JS Client로 DB 직접 접근
- **인증**: Supabase Auth (카카오 OAuth는 Edge Function 경유)
- **보안**: RLS(Row Level Security)로 행 수준 접근 제어
- **알림**: 웹 푸시 — 프론트가 구독 발급 → `save-push-subscription`이 저장 → 일정 CRUD 시 `send-notification`이 VAPID 서명 + 페이로드 암호화 후 푸시 서비스로 발송 → Service Worker가 수신하여 OS 알림 표시
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

> 상세 변경 이력은 [CHANGELOG.md](CHANGELOG.md) 참조

- [x] 기획 → [기획서](docs/planning/service-planning.md) / 설계 → [설계서](docs/design/system-design.md)
- [x] 개발·테스트·배포 v1: Spring Boot + React (Render Docker + Static)
- [x] 구조 전환 (2026-02-23): Spring Boot → Supabase BaaS 중심 (백엔드 제거, Edge Functions, RLS)
- [x] 에이전트 팀 구성 (2026-02-24): issue-resolution-team (Designer + Developer + QA 병렬)
- [x] UX 개선 (2026-03-01): 로딩 팝업, RLS 우회 Edge Function, 세션 관리 개선
- [x] 기능·UI·알림 안정화 (2026-03-02): 로그인 디자인, 캘린더 스와이프, 알림톡 토큰 갱신, QA 10건
- [x] iOS 로그인·캘린더 근본 수정 (2026-03-03): bfcache 방지, 다일 일정, 캐러셀 애니메이션
- [x] 알림 fade-out + 조퇴 유형 (2026-03-04): 알림 비활성화, EARLY_LEAVE 추가
- [x] 무한 렌더링·MyPage·서비스명 (2026-03-08): 세션 감지 단일화, 사용자 정보 표시
- [x] QA 종합 점검 (2026-03-09): 보안/버그 18건 (CORS, HMAC, signOut 등)
- [x] Edge Function JWT 통합 수정 (2026-03-10): --no-verify-jwt 일괄 적용, 무한 리다이렉트 수정
- [x] 웹 푸시 알림 도입 (2026-09-23): 알림톡 대신 Web Push 채택, PWA 전환, 동의 바텀시트, 작성자 제외

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
VITE_VAPID_PUBLIC_KEY=[VAPID 공개키 - 공개 가능]
```

템플릿: `frontend/.env.example` 참고

**Supabase Edge Functions 환경변수 (Supabase Dashboard에서 설정)**
```
KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[카카오 시크릿]
SUPABASE_URL=https://qphhpfolrbsyiyoevaoe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[Supabase Service Role Key]
SUPABASE_ANON_KEY=[Supabase Anon Key]
VAPID_PUBLIC_KEY=[VAPID 공개키]
VAPID_PRIVATE_KEY=[VAPID 개인키 - 절대 노출 금지]
VAPID_SUBJECT=https://jsk-schedule-frontend.onrender.com
```

> **VAPID 키 관리 ⚠️**
> - 공개키 기본값은 **소스 2곳**에 하드코딩되어 있다. 교체 시 반드시 함께 수정할 것:
>   - `frontend/src/lib/push.js` → `VAPID_PUBLIC_KEY_FALLBACK`
>   - `frontend/public/sw.js` → `VAPID_PUBLIC_KEY` (`public/`은 Vite 치환 대상이 아님)
> - `VITE_VAPID_PUBLIC_KEY` 환경변수가 있으면 그 값이 우선한다 (없으면 위 기본값 사용).
> - 공개키를 소스에 두는 이유: 원래 브라우저로 전달되는 공개 값이며, **Render가 `render.yaml`을 읽지 않아**
>   환경변수에만 의존하면 대시보드에 키를 넣기 전까지 알림이 동작하지 않는다. (아래 "배포 구성 주의" 참조)
> - 개인키(`VAPID_PRIVATE_KEY`)는 Supabase Secrets에만 둔다. **절대 소스에 넣지 말 것.**
> - **키를 교체하면 기존 구독이 전부 무효화**되어 전원이 다시 동의해야 한다.

> **배포 구성 주의 ⚠️ (2026-09-23 확인)**
> `render.yaml`은 **실제 배포에 적용되지 않는다.** 서비스는 Render 대시보드에서 관리되는 Static Site이며,
> 환경변수·빌드 설정 모두 대시보드 값이 사용된다.
> - 근거: `render.yaml`에 새 환경변수를 추가해도 빌드 번들에 주입되지 않음을 확인했다.
>   (기존 `VITE_*` 4개는 번들에 존재 → 대시보드에 설정되어 있음)
> - **`VITE_*` 환경변수를 추가/변경하려면 Render 대시보드 → Environment 에서 직접 수정해야 한다.**
> - `render.yaml`은 현재 문서·참고용이다. 실제 구성과 어긋나지 않도록 유지하되, 변경해도 반영되지 않는다.
> - 키 재생성: `node -e "const{generateKeyPairSync}=require('crypto');const{publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const p=publicKey.export({format:'jwk'});const d=s=>Buffer.from(s,'base64url');console.log('public =',Buffer.concat([Buffer.from([4]),d(p.x),d(p.y)]).toString('base64url'));console.log('private=',privateKey.export({format:'jwk'}).d)"`

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
supabase functions deploy kakao-auth --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy send-notification --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy save-push-subscription --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy update-user-name --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy delete-user --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy soft-delete-schedule --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
supabase functions deploy update-schedule --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt
```

---

## 외부 서비스 연동 - CLI 확인 & 작업 가이드

**원칙**: 작업 수행 전 CLI 설치/로그인/환경변수 확인 후, 가능할 경우 직접 실행.

### 주요 CLI 명령어

| 서비스 | 확인 | 주요 작업 |
|--------|------|-----------|
| **Supabase** | `supabase projects list` | `supabase functions deploy [함수명] --project-ref qphhpfolrbsyiyoevaoe --no-verify-jwt` |
| **GitHub** | `gh auth status` | `git push`, `gh pr create` |
| **Render** | `render.yaml` 수정 → `git push` (자동 배포) | Dashboard: 수동 배포, 로그 조회 |
| **Kakao** | 환경변수 확인 (`VITE_KAKAO_CLIENT_ID`) | OAuth 테스트 (localhost:5173) |

### Supabase 추가 명령어
```bash
supabase secrets list --project-ref qphhpfolrbsyiyoevaoe    # 환경변수 조회
supabase secrets set KEY=VALUE --project-ref qphhpfolrbsyiyoevaoe  # 환경변수 설정
supabase functions get-logs [함수명] --project-ref qphhpfolrbsyiyoevaoe  # 로그 조회
```

### Kakao OAuth 설정 (수동)
- **Redirect URI**: `http://localhost:5173/auth/callback` (로컬) / `https://jsk-schedule-frontend.onrender.com/auth/callback` (배포)
- **Logout Redirect URI** (Kakao Developers Console → 카카오 로그인 → 고급): 배포 `/login`, 로컬 `/login`

### 작업 시작 전 확인
```bash
supabase projects list > /dev/null 2>&1 && echo "Supabase ✅" || echo "Supabase ❌"
gh auth status 2>&1 | grep -q "Logged in" && echo "GitHub ✅" || echo "GitHub ❌"
[ -f frontend/.env ] && echo "frontend/.env ✅" || echo "frontend/.env ❌"
node --version && npm --version
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

# 이미지 전달 규칙

## 스크린샷/이미지 공유 방법

사용자가 이미지로 정보를 전달할 때는 아래 규칙을 따른다.

- **저장 경로**: `C:\AI Project\JSK_schedule manager\img\`
- **전달 방법**: 해당 폴더에 이미지 저장 후 파일명 알려주기
- **Claude 처리**: 파일명을 받으면 `Read` 도구로 해당 경로의 이미지를 읽어 정보 판단

**예시:**
- 사용자: `"login-error.png 봐줘"`
- Claude: `C:\AI Project\JSK_schedule manager\img\login-error.png` 읽어서 내용 분석

---

# claude.md 파일 관리 규칙

## 정책
1. task 완료 후, 커밋 하기 전에 claude.md 파일 업데이트 필요 여부 판단
   1.1. 필요 판단 시, claude.md 파일 업데이트 (단, 나에게 before / after 비교표 보여주고, 컨펌 후 업데이트 할 것)
2. 그 다음, claude.md 외에 관련된 md 파일의 업데이트 필요 여부 판단
   2.1. 필요 판단 시, 해당되는 파일 업데이트 (단, 나에게 before / after 비교표 보여주고, 컨펌 후 업데이트 할 것)
