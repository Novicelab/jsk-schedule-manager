# 🚀 Render 배포 가이드

Render에 JSK 일정 관리 서비스를 배포하는 단계별 가이드입니다.

---

## 📋 목차
1. [사전 준비](#사전-준비)
2. [백엔드 배포](#백엔드-배포)
3. [프론트엔드 배포](#프론트엔드-배포)
4. [환경 변수 설정](#환경-변수-설정)
5. [배포 검증](#배포-검증)
6. [트러블슈팅](#트러블슈팅)

---

## 📝 사전 준비

### 필요한 정보
- GitHub 계정 및 저장소
- Render 계정
- Supabase 데이터베이스 접근 정보
- Kakao 개발자 콘솔 앱 정보

### Kakao 콘솔에 Redirect URI 등록
```
1. https://developers.kakao.com 접속
2. 내 애플리케이션 → "JSK 일정 관리"
3. 제품 설정 → Kakao Login
4. Redirect URI에 추가:
   ✅ https://schedule.onrender.com/auth/callback
```

---

## 🔧 백엔드 배포

### Step 1: GitHub에 코드 커밋

```bash
cd "C:\AI Project\JSK_schedule manager"
git add .
git commit -m "chore: update environment configuration for production"
git push origin main
```

### Step 2: Render 대시보드에서 Backend 서비스 생성/수정

#### 새로 생성하는 경우:
1. **Render 대시보드** 접속
2. **+ New** → **Web Service**
3. GitHub 저장소 선택
4. 다음 설정:
   - **Name**: jsk-schedule-backend
   - **Environment**: Docker
   - **Region**: Singapore (ap-southeast-1)
   - **Build Command**: `./gradlew build -x test`
   - **Start Command**: `java -Dserver.port=$PORT -Dspring.profiles.active=prod -jar build/libs/jsk-schedule-manager-0.0.1-SNAPSHOT.jar`

#### 기존 서비스 수정:
1. **Render 대시보드** → **jsk-schedule-backend**
2. **Settings** 탭 → 위 설정 확인

### Step 3: 환경 변수 설정

**Backend 서비스** → **Environment** → 다음 변수 추가:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `SPRING_PROFILES_ACTIVE` | `prod` | 프로덕션 프로파일 |
| `SUPABASE_DB_PASSWORD` | [Supabase 비밀번호] | PostgreSQL 데이터베이스 비밀번호 |
| `JWT_SECRET` | [32자 이상의 보안 키] | JWT 서명 키 (최소 32자) |
| `KAKAO_CLIENT_ID` | `240f33554023d9ab4957b2d638fb0d71` | Kakao REST API Key |
| `KAKAO_CLIENT_SECRET` | [Kakao Client Secret] | Kakao 앱 시크릿 |
| `KAKAO_REDIRECT_URI` | `https://schedule.onrender.com/auth/callback` | Kakao 콜백 주소 |
| `APP_CORS_ALLOWED_ORIGINS` | `https://schedule.onrender.com` | CORS 허용 도메인 |

**저장** 클릭 후 **Manual Deploy** 선택 (또는 GitHub 푸시 시 자동 배포)

### Step 4: 백엔드 배포 확인

```bash
# 1. 배포 로그 확인
Render Dashboard → jsk-schedule-backend → Logs

# 2. 헬스 체크 (성공하면 200 응답)
curl https://jsk-schedule-backend.onrender.com/health

# 3. API 응답 확인
curl -X GET https://jsk-schedule-backend.onrender.com/api/schedules \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

---

## 🎨 프론트엔드 배포

### Step 1: 프론트엔드 .env 설정 (로컬)

```bash
# frontend/.env
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=https://schedule.onrender.com/auth/callback
VITE_API_BASE_URL=https://jsk-schedule-backend.onrender.com
```

### Step 2: GitHub에 커밋

```bash
cd frontend
git add .
git commit -m "chore: update production environment variables"
git push origin main
```

### Step 3: Render 대시보드에서 Frontend 서비스 생성/수정

#### 새로 생성하는 경우:
1. **Render 대시보드** 접속
2. **+ New** → **Static Site**
3. GitHub 저장소 선택
4. 다음 설정:
   - **Name**: schedule
   - **Publish directory**: `frontend/dist`
   - **Build Command**: `cd frontend && npm install && npm run build`

#### 기존 서비스 수정:
1. **Render 대시보드** → **schedule**
2. **Settings** 탭 → 위 설정 확인

### Step 4: 환경 변수 설정

**Frontend 서비스** → **Environment** → 다음 변수 추가:

| 변수명 | 값 |
|--------|-----|
| `VITE_KAKAO_CLIENT_ID` | `240f33554023d9ab4957b2d638fb0d71` |
| `VITE_KAKAO_REDIRECT_URI` | `https://schedule.onrender.com/auth/callback` |
| `VITE_API_BASE_URL` | `https://jsk-schedule-backend.onrender.com` |

**저장** 클릭 후 **Clear Build Cache & Deploy** 선택 (환경 변수 변경 시 캐시 제거 필수)

### Step 5: 프론트엔드 배포 확인

```bash
# 1. 배포 로그 확인
Render Dashboard → schedule → Logs

# 2. 프론트엔드 접속 확인
https://schedule.onrender.com

# 3. 콘솔에서 환경 변수 확인 (브라우저 DevTools)
console.log(import.meta.env.VITE_API_BASE_URL)
// 출력: https://jsk-schedule-backend.onrender.com
```

---

## 🔐 환경 변수 설정

### 백엔드 환경 변수 (application-prod.yml에서 로드)

```yaml
server:
  port: ${PORT}

spring:
  datasource:
    url: jdbc:postgresql://aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
    username: postgres.qphhpfolrbsyiyoevaoe
    password: ${SUPABASE_DB_PASSWORD}

jwt:
  secret: ${JWT_SECRET}

kakao:
  client-id: ${KAKAO_CLIENT_ID}
  client-secret: ${KAKAO_CLIENT_SECRET}
  redirect-uri: ${KAKAO_REDIRECT_URI}

app:
  cors:
    allowed-origins: ${APP_CORS_ALLOWED_ORIGINS}
```

### 프론트엔드 환경 변수 (빌드 시점에 인라인됨)

```javascript
// Vite 빌드 시 다음 변수가 코드에 컴파일됨:
const kakaoClientId = import.meta.env.VITE_KAKAO_CLIENT_ID
const kakaoRedirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
```

**⚠️ 주의:** Vite 환경 변수는 빌드 시점에 고정되므로, 환경 변수 변경 후 **반드시 다시 빌드**해야 합니다.

---

## ✅ 배포 검증

### 1. 로그인 흐름 테스트

```bash
# 1. 프론트엔드 접속
https://schedule.onrender.com

# 2. "카카오로 시작하기" 클릭
# 3. Kakao 인증 페이지에서 승인
# 4. 신규 사용자면 이름 입력
# 5. 메인 페이지(캘린더) 로드 확인
```

### 2. API 호출 테스트

```bash
# JWT 토큰 획득 (로그인 후 localStorage에서)
TOKEN="[accessToken 값]"

# 일정 목록 조회
curl -X GET "https://jsk-schedule-backend.onrender.com/api/schedules?startDate=2026-02-01&endDate=2026-02-28" \
  -H "Authorization: Bearer $TOKEN"

# 응답 확인 (201 또는 200 상태코드)
```

### 3. 데이터베이스 연결 확인

```bash
# 1. Supabase 대시보드 접속
# 2. Database → postgres 테이블 확인
# 3. 새로운 사용자 데이터 저장 확인
```

### 4. 에러 로그 확인

```bash
# Render Dashboard
# Backend 서비스 → Logs → 에러 메시지 확인

# 예상되는 로그:
# [INFO] 카카오 OAuth 로그인 처리 시작
# [INFO] 신규 카카오 사용자 가입: kakaoId=xxxxx
# [INFO] JWT 토큰 생성: userId=x
```

---

## 🐛 트러블슈팅

### 문제 1: 백엔드 배포 실패 ("Build failed")

**확인 사항:**
```bash
# 로컬에서 빌드 성공 확인
./gradlew build

# Render 로그에서 에러 메시지 확인
# 일반적인 원인:
# - JDK 버전 불일치
# - 의존성 다운로드 실패
# - SQL 마이그레이션 오류
```

### 문제 2: 프론트엔드 배포 실패 ("npm install" 또는 "npm run build" 실패)

**확인 사항:**
```bash
# 로컬에서 빌드 성공 확인
cd frontend
npm install
npm run build

# 가능한 원인:
# - package.json 문법 오류
# - 의존성 버전 충돌
# - Node 버전 불일치
```

### 문제 3: 카카오 로그인 오류

**확인 사항:**
```
1. Kakao 콘솔의 Redirect URI 등록 확인
   ✅ https://schedule.onrender.com/auth/callback

2. 환경 변수 확인
   VITE_KAKAO_REDIRECT_URI = https://schedule.onrender.com/auth/callback
   KAKAO_REDIRECT_URI = https://schedule.onrender.com/auth/callback

3. 캐시 제거 후 재배포
   Render Dashboard → Frontend → "Clear Build Cache & Deploy"
```

### 문제 4: CORS 오류 ("Access-Control-Allow-Origin missing")

**확인 사항:**
```
1. 백엔드 환경 변수 확인
   APP_CORS_ALLOWED_ORIGINS = https://schedule.onrender.com

2. 백엔드 재배포
   Render Dashboard → Backend → Manual Deploy

3. 프론트엔드 재배포
   Render Dashboard → Frontend → Clear Build Cache & Deploy
```

### 문제 5: 프론트엔드에서 백엔드 API 호출 실패 (502/503 에러)

**확인 사항:**
```bash
# 백엔드 헬스 체크
curl https://jsk-schedule-backend.onrender.com/health

# Render Dashboard
# Backend 서비스 → Logs에서 에러 확인

# 가능한 원인:
# - 백엔드 서비스 다운
# - 데이터베이스 연결 실패
# - 메모리 부족으로 인한 크래시
```

---

## 📊 배포 상태 모니터링

### Render 대시보드에서 확인

```
1. Backend 서비스
   - Status: Running / Deploying / Failed
   - CPU, Memory 사용률 확인
   - Recent Builds 로그 확인

2. Frontend 서비스
   - Status: Live / Deploying / Failed
   - Recent Deploys 로그 확인
```

### 프로덕션 서비스 URL

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | https://schedule.onrender.com |
| 백엔드 API | https://jsk-schedule-backend.onrender.com |
| API 문서 (Swagger) | https://jsk-schedule-backend.onrender.com/swagger-ui.html |
| 헬스 체크 | https://jsk-schedule-backend.onrender.com/health |

---

## 📝 배포 체크리스트

### 배포 전:
- [ ] 로컬에서 모든 테스트 통과
- [ ] Git에 모든 변경사항 커밋
- [ ] 환경 변수가 로컬 `.env` 파일에 정의됨
- [ ] Kakao 콘솔에 리다이렉트 URI 등록됨

### 배포 중:
- [ ] 백엔드 환경 변수 Render에 설정
- [ ] 프론트엔드 환경 변수 Render에 설정
- [ ] Render에서 Manual Deploy 실행
- [ ] 배포 로그에서 에러 확인

### 배포 후:
- [ ] 프론트엔드 접속 확인 (https://...)
- [ ] "카카오로 시작하기" 로그인 테스트
- [ ] 신규 사용자 가입 흐름 테스트
- [ ] 일정 CRUD 작동 확인
- [ ] Render 대시보드에서 에러 모니터링

---

## 🔗 참고 링크

- [Render Documentation](https://render.com/docs)
- [Kakao Developers](https://developers.kakao.com)
- [Spring Boot Production Ready](https://spring.io/projects/spring-boot)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)

