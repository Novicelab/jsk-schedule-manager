# 🔧 환경 설정 가이드

JSK 일정 관리 서비스의 로컬 개발 및 프로덕션 배포 환경 설정 가이드입니다.

---

## 📋 목차
1. [로컬 개발 환경](#로컬-개발-환경)
2. [프로덕션 배포 (Render)](#프로덕션-배포-render)
3. [카카오 개발자 콘솔 설정](#카카오-개발자-콘솔-설정)
4. [트러블슈팅](#트러블슈팅)

---

## 🖥️ 로컬 개발 환경

### 1. 프론트엔드 설정

#### `frontend/.env` 파일

```bash
# ============================================
# 로컬 개발 환경 설정
# ============================================

# Kakao OAuth Configuration (REST API Key 사용)
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback

# Backend API Base URL
VITE_API_BASE_URL=http://localhost:9090
```

**설명:**
- `VITE_KAKAO_CLIENT_ID`: Kakao 앱의 REST API Key (App Number 아님)
- `VITE_KAKAO_REDIRECT_URI`: Kakao 인증 후 돌아올 주소 (프론트엔드 포트: 5173)
- `VITE_API_BASE_URL`: 백엔드 API 주소 (포트: 9090)

#### `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,              // 프론트엔드 포트
    proxy: {
      '/api': {
        target: 'http://localhost:9090',  // 백엔드 포트
        changeOrigin: true,
      }
    }
  }
})
```

**설명:**
- `server.port: 5173`: 프론트엔드는 **5173 포트**에서 실행
- `proxy.target`: 백엔드는 **9090 포트**에서 실행

### 2. 백엔드 설정

#### `src/main/resources/application-local.yml`

```yaml
server:
  port: 9090

kakao:
  client-id: "240f33554023d9ab4957b2d638fb0d71"
  client-secret: test-client-secret-for-local-dev
  redirect-uri: http://localhost:5173/auth/callback
  alimtalk-sender-key: test-sender-key-for-local-dev

app:
  cors:
    allowed-origins: http://localhost:5173
```

**설명:**
- `server.port: 9090`: 백엔드는 **9090 포트**에서 실행
- `kakao.redirect-uri`: 프론트엔드의 콜백 주소와 **정확히 일치**해야 함
- `app.cors.allowed-origins`: 프론트엔드 주소를 **5173**으로 설정

### 3. 로컬 실행 방법

#### 터미널 1 (백엔드):
```bash
cd "C:\AI Project\JSK_schedule manager"

# 옵션 A: JAR 파일로 실행 (권장)
SPRING_PROFILES_ACTIVE=local java -jar build/libs/jsk-schedule-manager-0.0.1-SNAPSHOT.jar

# 옵션 B: Gradle로 직접 실행
./gradlew bootRun -Pargs='--spring.profiles.active=local'
```

#### 터미널 2 (프론트엔드):
```bash
cd "C:\AI Project\JSK_schedule manager\frontend"
npm run dev
```

#### 터미널 3 (선택사항 - 빌드):
```bash
cd "C:\AI Project\JSK_schedule manager"
./gradlew build
```

### 4. 로컬 포트 확인

| 서비스 | 포트 | URL |
|--------|------|-----|
| 프론트엔드 | 5173 | http://localhost:5173 |
| 백엔드 API | 9090 | http://localhost:9090 |
| H2 Database Console | 9090 | http://localhost:9090/h2-console |

---

## 🚀 프로덕션 배포 (Render)

### 1. Render 백엔드 환경 변수

Render Dashboard에서 Backend 서비스 선택 → **Environment** 탭:

```
SPRING_PROFILES_ACTIVE=prod

# Database (Supabase)
SUPABASE_DB_PASSWORD=[Supabase 비밀번호]

# JWT 인증
JWT_SECRET=[32자 이상의 보안 키]

# Kakao OAuth
KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[Kakao Client Secret]
KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback

# CORS
APP_CORS_ALLOWED_ORIGINS=https://jsk-schedule-frontend.onrender.com
```

### 2. Render 프론트엔드 환경 변수

Render Dashboard에서 Frontend 서비스 선택 → **Environment** 탭:

```
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback
VITE_API_BASE_URL=https://jsk-schedule-backend.onrender.com
```

### 3. Render 배포 확인

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | https://jsk-schedule-frontend.onrender.com |
| 백엔드 API | https://jsk-schedule-backend.onrender.com |

#### 배포 후 테스트:
```bash
# 백엔드 헬스 체크
curl https://jsk-schedule-backend.onrender.com/health

# 프론트엔드 로그인 페이지
https://jsk-schedule-frontend.onrender.com
```

---

## 🔐 카카오 개발자 콘솔 설정

### 1. Kakao 앱 리다이렉트 URI 등록

1. https://developers.kakao.com 접속
2. **내 애플리케이션** → **"JSK 일정 관리"** 선택
3. 좌측 메뉴: **제품 설정** → **Kakao Login**
4. **Redirect URI** 섹션에 다음 URI 등록:

```
✅ http://localhost:5173/auth/callback          (로컬 개발)
✅ https://jsk-schedule-frontend.onrender.com/auth/callback  (프로덕션)
```

#### 등록 방법:
- **URI 추가 입력 필드**에 입력 후 **저장**
- 두 URI 모두 등록되어야 함

### 2. 동의항목 설정 (필수)

1. 좌측 메뉴: **제품 설정** → **Kakao Login** → **동의항목**
2. **필수 항목**으로 설정:
   - ✅ 프로필(닉네임/프로필사진)
   - ✅ 카카오계정(이메일)
3. **선택 항목** (옵션):
   - 생일
   - 성별
   - 전화번호

> ⚠️ **프로필 정보**가 필수가 아니면 nickname이 null일 수 있습니다. 반드시 **필수**로 설정하세요!

### 3. REST API Key 확인

Kakao 앱 설정에서 **앱 정보** 탭:
- **REST API Key**: `240f33554023d9ab4957b2d638fb0d71` (사용할 값)
- ⚠️ **App Number**: `1389155` (사용하지 말 것 - 구식)

---

## ✅ 체크리스트

### 로컬 환경 설정:
- [ ] `frontend/.env` 파일에 올바른 값 설정
- [ ] `VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71`
- [ ] `VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback`
- [ ] `VITE_API_BASE_URL=http://localhost:9090`
- [ ] `application-local.yml`에서 `allowed-origins: http://localhost:5173`
- [ ] 프론트엔드가 5173 포트에서 실행 중
- [ ] 백엔드가 9090 포트에서 실행 중

### 프로덕션 (Render) 설정:
- [ ] Render 백엔드 환경변수 설정 완료
  - KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI
- [ ] Render 프론트엔드 환경변수 설정 완료
  - VITE_KAKAO_CLIENT_ID, VITE_KAKAO_REDIRECT_URI, VITE_API_BASE_URL
- [ ] Render 배포 완료 (GitHub 푸시 또는 수동 배포)

### Kakao 콘솔 설정:
- [ ] 리다이렉트 URI 등록 (로컬 + 프로덕션 모두)
- [ ] 동의항목에 프로필 정보 **필수**로 설정
- [ ] REST API Key 확인 (`240f33554023d9ab4957b2d638fb0d71`)

---

## 🐛 트러블슈팅

### 문제 1: "카카오로 시작하기" 클릭 후 에러 페이지

**원인:** Redirect URI 불일치

**해결책:**
1. Kakao 콘솔의 리다이렉트 URI 확인
   ```
   ✅ http://localhost:5173/auth/callback
   ✅ https://jsk-schedule-frontend.onrender.com/auth/callback
   ```
2. 프론트엔드 `.env` 파일 확인
   ```
   VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback
   ```
3. 백엔드 `application-local.yml` 또는 `application-prod.yml` 확인
   ```yaml
   kakao:
     redirect-uri: http://localhost:5173/auth/callback
   ```

### 문제 2: "인증 코드가 없습니다" 에러

**원인:** Kakao가 리다이렉트할 때 code 파라미터가 없음

**확인 방법:**
1. 브라우저 주소창 확인 (예상: `http://localhost:5173/auth/callback?code=xxxxx`)
2. Kakao 콘솔에서 앱 활성 상태 확인
3. Kakao 콘솔에서 리다이렉트 URI 등록 확인

### 문제 3: CORS 오류 ("Access-Control-Allow-Origin")

**원인:** 백엔드의 CORS 설정이 프론트엔드 주소를 허용하지 않음

**해결책:**
```yaml
# application-local.yml
app:
  cors:
    allowed-origins: http://localhost:5173

# application-prod.yml
app:
  cors:
    allowed-origins: https://jsk-schedule-frontend.onrender.com
```

### 문제 4: 프론트엔드 포트 충돌 (Port 5173 already in use)

**원인:** 다른 프로세스가 5173 포트를 사용 중

**해결책:**
```bash
# 프로세스 확인 (Windows)
netstat -ano | findstr :5173

# 포트 해제 후 다시 시작
npm run dev
```

### 문제 5: 백엔드가 프런트엔드 요청을 거부 (401 Unauthorized)

**원인:** JWT 토큰이 없거나 만료됨

**확인 방법:**
1. 브라우저 개발자 도구 → Application → LocalStorage
2. `accessToken` 및 `refreshToken` 확인
3. 토큰이 없으면 로그인 다시 수행

---

## 📚 참고

- [Kakao Developers](https://developers.kakao.com)
- [Render Documentation](https://render.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [Spring Boot Configuration](https://spring.io/projects/spring-boot)

