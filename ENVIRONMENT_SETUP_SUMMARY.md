# 🎯 환경 설정 통합 완료 - 최종 요약

**완료일**: 2026-02-21
**커밋**: 099cbfd (main 브랜치)

---

## 📌 해결한 문제

### 원래 문제
**"카카오로 시작하기" 클릭 후 에러 페이지로 리다이렉트**

### 근본 원인
1. **Vite 환경 변수는 빌드 시점에 고정됨**
   - 로컬 `.env`에 설정된 값이 프로덕션 빌드에도 그대로 컴파일됨
   - Render 배포 시 여전히 `localhost:5173` 주소로 작동

2. **Redirect URI 불일치**
   - Kakao 콘솔에 등록된 URI: `https://schedule.onrender.com/auth/callback`
   - 배포된 프론트엔드가 보내는 URI: `http://localhost:5173/auth/callback` ❌
   - Kakao가 거부 → 에러 페이지

3. **포트 설정 불일치**
   - 프론트엔드 설정: port 3000, proxy 6666 (구식)
   - 실제 실행: port 5173 (Vite 자동)
   - 백엔드 설정: port 9090 (정확)
   - CORS 설정: localhost:3001 (오래된)

---

## ✅ 적용된 수정사항

### 1. 프론트엔드 설정 수정

#### `frontend/vite.config.js`
```javascript
// 변경 전
server: {
  port: 3000,
  proxy: { '/api': { target: 'http://localhost:6666' } }
}

// 변경 후
server: {
  port: 5173,  // ✅ Vite 기본값
  proxy: { '/api': { target: 'http://localhost:9090' } }  // ✅ 백엔드 포트
}
```

#### `frontend/.env.example`
```bash
# 로컬 개발 환경 (명확한 주석 추가)
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback  # ✅ 5173
VITE_API_BASE_URL=http://localhost:9090  # ✅ 9090

# 프로덕션 환경 (Render 배포 시 참고용)
# VITE_KAKAO_REDIRECT_URI=https://schedule.onrender.com/auth/callback
# VITE_API_BASE_URL=https://jsk-schedule-backend.onrender.com
```

### 2. 백엔드 설정 수정

#### `src/main/resources/application-local.yml`
```yaml
kakao:
  redirect-uri: http://localhost:5173/auth/callback  # ✅ 5173

app:
  cors:
    allowed-origins: http://localhost:5173  # ✅ 3001 → 5173
```

### 3. 문서화 추가

#### `docs/environment-setup.md` (신규)
- ✅ 로컬 개발 환경 설정 완벽 가이드
- ✅ 프로덕션 (Render) 환경 설정
- ✅ Kakao 콘솔 설정 가이드
- ✅ 트러블슈팅 (6가지 일반적인 문제 + 해결책)

#### `docs/render-deployment.md` (신규)
- ✅ Render 배포 단계별 가이드
- ✅ 백엔드/프론트엔드 배포 방법
- ✅ 환경 변수 설정 체크리스트
- ✅ 배포 검증 방법
- ✅ 트러블슈팅 (5가지 프로덕션 문제)

---

## 🔧 로컬 환경 설정 및 테스트

### Step 1: 환경 확인
```bash
# 현재 상태
프론트엔드: localhost:5173 ✅
백엔드: localhost:9090 ✅
Kakao Redirect: http://localhost:5173/auth/callback ✅
```

### Step 2: 백엔드 시작
```bash
cd "C:\AI Project\JSK_schedule manager"
SPRING_PROFILES_ACTIVE=local java -jar build/libs/jsk-schedule-manager-0.0.1-SNAPSHOT.jar
# 또는
./gradlew bootRun -Pargs='--spring.profiles.active=local'
```

### Step 3: 프론트엔드 시작
```bash
cd frontend
npm run dev
# 출력: VITE v5.x.x ready in 1234 ms
# 자동으로 http://localhost:5173 열림
```

### Step 4: 로그인 테스트
```
1. http://localhost:5173 접속
2. "카카오로 시작하기" 클릭
3. Kakao 인증 페이지에서 승인
4. 신규 사용자면 이름 입력 팝업
5. ✅ 캘린더 페이지 정상 표시
```

---

## 🚀 프로덕션 (Render) 배포

### Step 1: Render 백엔드 환경 변수 설정
```
Dashboard → Backend Service → Environment
추가할 변수:

KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[시크릿 값]
KAKAO_REDIRECT_URI=https://schedule.onrender.com/auth/callback
APP_CORS_ALLOWED_ORIGINS=https://schedule.onrender.com

(기타 변수: JWT_SECRET, SUPABASE_DB_PASSWORD 등)
```

### Step 2: Render 프론트엔드 환경 변수 설정
```
Dashboard → Frontend Service → Environment
추가할 변수:

VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=https://schedule.onrender.com/auth/callback
VITE_API_BASE_URL=https://jsk-schedule-backend.onrender.com
```

### Step 3: Kakao 콘솔 설정
```
1. https://developers.kakao.com 접속
2. 제품 설정 → Kakao Login
3. Redirect URI에 등록:
   ✅ http://localhost:5173/auth/callback (로컬 개발)
   ✅ https://schedule.onrender.com/auth/callback (프로덕션)
```

### Step 4: 배포 및 검증
```bash
# GitHub 푸시 (자동 배포)
git push origin main

# 또는 수동 배포
Render Dashboard → Manual Deploy

# 배포 완료 확인
https://schedule.onrender.com → 로그인 테스트
```

---

## 📋 환경 설정 비교표

| 항목 | 로컬 개발 | 프로덕션 |
|------|---------|---------|
| **프론트엔드 URL** | http://localhost:5173 | https://schedule.onrender.com |
| **백엔드 URL** | http://localhost:9090 | https://jsk-schedule-backend.onrender.com |
| **Kakao Redirect** | http://localhost:5173/auth/callback | https://schedule.onrender.com/auth/callback |
| **CORS Origin** | http://localhost:5173 | https://schedule.onrender.com |
| **DB** | H2 In-Memory | Supabase PostgreSQL |
| **프로파일** | `local` | `prod` |

---

## 🔍 주의사항

### 1. Vite 환경 변수는 빌드 시 고정됨
```javascript
// 빌드 시점에 다음처럼 컴파일됨:
const apiUrl = "https://jsk-schedule-backend.onrender.com"  // 하드코딩됨
// 런타임에 변경 불가능
```

### 2. 환경 변수 변경 후 반드시 재배포
```
Render Dashboard → Frontend → "Clear Build Cache & Deploy"
(캐시 제거 없이 배포하면 이전 환경 변수가 사용됨)
```

### 3. Kakao 콘솔에 Redirect URI 등록 필수
```
등록되지 않은 URI로 요청 → Kakao 거부 → 에러 페이지
따라서 로컬 + 프로덕션 URI 모두 등록해야 함
```

### 4. 포트 충돌 확인
```bash
# Windows에서 포트 확인
netstat -ano | findstr :5173
netstat -ano | findstr :9090

# 사용 중인 포트는 변경하거나 프로세스 종료
```

---

## 📚 참고 문서

- **로컬 환경 설정**: `docs/environment-setup.md`
- **Render 배포**: `docs/render-deployment.md`
- **변경 내역**: `CHANGELOG.md`

---

## ✨ 다음 단계

### 로컬 테스트 (지금)
```bash
1. 백엔드 시작 (포트 9090)
2. 프론트엔드 시작 (포트 5173)
3. http://localhost:5173에서 로그인 테스트
4. ✅ 정상 동작 확인
```

### 프로덕션 배포 (준비 완료)
```bash
1. Render 백엔드/프론트엔드 환경 변수 설정
2. GitHub 푸시 또는 Render 수동 배포
3. https://schedule.onrender.com에서 테스트
4. Kakao 로그인 정상 확인
```

---

## 📞 지원

문제 발생 시:
1. `docs/environment-setup.md`의 트러블슈팅 섹션 확인
2. `docs/render-deployment.md`의 배포 검증 방법 확인
3. Render/Kakao 대시보드의 로그 확인

---

**커밋**: `099cbfd`
**수정 파일**: 6개 (frontend/.env.example, frontend/vite.config.js, application-local.yml, CHANGELOG.md, 2개 문서)
**상태**: ✅ 모든 환경 변수 설정 완료, 배포 준비 완료

