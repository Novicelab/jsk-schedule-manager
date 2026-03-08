# 🚀 Render 프로덕션 배포 체크리스트 (2026-02-21)

**배포 상태**: 준비 완료 ✅
**커밋**: f9cba3c (main 브랜치)

---

## 📋 배포 단계

### **Step 1: Render 백엔드 환경 변수 설정** (5분)

**위치**: https://dashboard.render.com → jsk-schedule-backend → Environment

#### 추가/수정할 환경 변수:

```bash
# Spring Profile
SPRING_PROFILES_ACTIVE=prod

# Database (Supabase)
SUPABASE_DB_PASSWORD=[기존 값 유지]

# JWT
JWT_SECRET=[기존 값 유지]

# ⭐ Kakao OAuth (중요!)
KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[기존 값 유지]
KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback

# CORS
APP_CORS_ALLOWED_ORIGINS=https://jsk-schedule-frontend.onrender.com
```

**✅ 완료**: "Save" 클릭

---

### **Step 2: Render 프론트엔드 환경 변수 설정** (5분)

**위치**: https://dashboard.render.com → jsk-schedule-frontend → Environment

#### 추가/수정할 환경 변수:

```bash
# Kakao OAuth (중요!)
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback

# Backend API
VITE_API_BASE_URL=https://jsk-schedule-backend.onrender.com
```

**✅ 완료**: "Save" 클릭

---

### **Step 3: 프론트엔드 캐시 제거 후 재배포** (1분)

**중요**: Vite 환경 변수는 빌드 시점에 고정되므로, 환경 변수 변경 후 **반드시 캐시 제거** 필요

**위치**: https://dashboard.render.com → jsk-schedule-frontend

1. **"Clear Build Cache & Deploy"** 버튼 클릭
2. 배포 시작 (로그 창에서 진행 상황 확인)
3. **배포 완료 대기** (약 5-10분)

**✅ 상태 확인**:
```
- Status: Running (초록색)
- 마지막 배포: 현재 시간
```

---

### **Step 4: 백엔드 재배포** (선택사항)

환경 변수 변경 후 백엔드 자동 재배포가 될 수 있지만, 수동 재배포 권장:

**위치**: https://dashboard.render.com → jsk-schedule-backend

1. **"Manual Deploy"** 클릭
2. 배포 시작 (로그 창에서 진행 상황 확인)
3. **배포 완료 대기** (약 3-5분)

**✅ 상태 확인**:
```
- Status: Live (초록색)
- 마지막 배포: 현재 시간
```

---

### **Step 5: 배포 검증** (2분)

#### 1️⃣ 헬스 체크
```bash
curl https://jsk-schedule-backend.onrender.com/health
# 응답: 200 OK (또는 비슷한 성공 응답)
```

#### 2️⃣ 프론트엔드 환경 변수 확인
```
1. https://jsk-schedule-frontend.onrender.com 접속
2. 브라우저 개발자 도구 (F12) → Console
3. 다음 명령어 실행:
   console.log(import.meta.env.VITE_API_BASE_URL)
   console.log(import.meta.env.VITE_KAKAO_REDIRECT_URI)
4. 출력 확인:
   ✅ https://jsk-schedule-backend.onrender.com
   ✅ https://jsk-schedule-frontend.onrender.com/auth/callback
```

#### 3️⃣ 카카오 로그인 테스트
```
1. https://jsk-schedule-frontend.onrender.com 접속
2. "카카오로 시작하기" 클릭
3. Kakao 인증 페이지 → 승인
4. 신규 사용자면 이름 입력 팝업 나타남
5. 이름 입력 후 "확인" 클릭
6. ✅ 캘린더 페이지가 표시되면 성공!
```

---

## 📊 배포 환경 확인

### 프로덕션 환경 URL
| 서비스 | URL | 상태 |
|--------|-----|------|
| 프론트엔드 | https://jsk-schedule-frontend.onrender.com | 🟢 Live |
| 백엔드 API | https://jsk-schedule-backend.onrender.com | 🟢 Live |
| 헬스 체크 | https://jsk-schedule-backend.onrender.com/health | 🟢 Live |

---

## ⏱️ 예상 배포 시간

| 단계 | 소요 시간 | 상태 |
|------|---------|------|
| 1. 백엔드 환경 변수 설정 | 1분 | ✅ |
| 2. 프론트엔드 환경 변수 설정 | 1분 | ✅ |
| 3. 프론트엔드 재배포 | 5-10분 | 진행 중 |
| 4. 백엔드 재배포 | 3-5분 | 진행 중 |
| 5. 배포 검증 | 2분 | 예정 |
| **총 소요 시간** | **약 15분** | |

---

## 🔍 배포 로그 확인

### 프론트엔드 로그
```
Render Dashboard → jsk-schedule-frontend → Logs

예상되는 로그:
- Building Docker image...
- npm install
- npm run build
- Deploying...
- Successfully deployed
```

### 백엔드 로그
```
Render Dashboard → jsk-schedule-backend → Logs

예상되는 로그:
- Building Docker image...
- ./gradlew build -x test
- Starting jsk-schedule-manager...
- Tomcat started on port(s): 8080
```

---

## ✅ 최종 체크리스트

### 배포 전 확인
- [x] 로컬 코드 수정 완료
- [x] Git 커밋 및 푸시 완료
- [x] 모든 문서 작성 완료

### 배포 중 수행사항
- [ ] **Step 1**: Render 백엔드 환경 변수 설정 ← 사용자
- [ ] **Step 2**: Render 프론트엔드 환경 변수 설정 ← 사용자
- [ ] **Step 3**: 프론트엔드 "Clear Build Cache & Deploy" ← 사용자
- [ ] **Step 4**: 백엔드 "Manual Deploy" ← 사용자
- [ ] **Step 5**: 배포 검증 ← 사용자

### 배포 후 테스트
- [ ] 프론트엔드 접속 가능: https://jsk-schedule-frontend.onrender.com
- [ ] 백엔드 헬스 체크: https://jsk-schedule-backend.onrender.com/health
- [ ] 프론트엔드 환경 변수 올바름 (콘솔 확인)
- [ ] **카카오 로그인 정상 작동** ← 최종 테스트
- [ ] 신규 사용자 이름 입력 팝업 표시
- [ ] 캘린더 페이지 정상 표시
- [ ] 일정 CRUD 작동 확인

---

## 🆘 트러블슈팅

### 문제: "프론트엔드 환경 변수가 여전히 localhost"
**원인**: 캐시가 제거되지 않음
**해결**: "Clear Build Cache & Deploy" 다시 클릭

### 문제: "카카오 로그인 실패"
**확인사항**:
1. Kakao 콘솔에서 Redirect URI 등록 확인
2. 환경 변수 설정 확인:
   - `KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback`
   - `VITE_KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback`
3. 백엔드 재배포 실행

### 문제: "CORS 에러"
**원인**: CORS 설정이 업데이트되지 않음
**해결**: 백엔드 재배포 실행

### 문제: "API 호출 502/503 에러"
**확인사항**:
1. 백엔드 로그 확인
2. 데이터베이스 연결 상태 확인
3. 백엔드 메모리 사용률 확인

---

## 📞 지원

상세 배포 가이드: `docs/render-deployment.md`
환경 설정 가이드: `docs/environment-setup.md`
트러블슈팅: 위 문서의 "트러블슈팅" 섹션

---

**배포 준비 완료!** 🚀
위 단계를 따라 Render에 배포하세요. 모든 환경 변수와 설정이 이미 준비되어 있습니다.

