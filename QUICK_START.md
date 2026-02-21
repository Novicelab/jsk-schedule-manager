# 🚀 빠른 시작 가이드

환경 설정 수정이 완료되었습니다. 다음 단계를 따르세요.

---

## ⚡ 5분 안에 로컬 환경에서 실행하기

### Step 1: 백엔드 시작 (터미널 1)
```bash
cd "C:\AI Project\JSK_schedule manager"
SPRING_PROFILES_ACTIVE=local java -jar build/libs/jsk-schedule-manager-0.0.1-SNAPSHOT.jar
```
✅ 완료: `Tomcat started on port(s): 9090`이 보이면 성공

### Step 2: 프론트엔드 시작 (터미널 2)
```bash
cd frontend
npm run dev
```
✅ 완료: 브라우저가 자동으로 `http://localhost:5173` 열림

### Step 3: 로그인 테스트
```
1. "카카오로 시작하기" 클릭
2. Kakao 인증 완료
3. 신규 사용자면 이름 입력
4. 캘린더 페이지가 보이면 성공! ✅
```

---

## 🔧 변경된 환경 설정

### 프론트엔드
| 설정 | 변경 전 | 변경 후 |
|------|--------|--------|
| **포트** | 3000 | **5173** |
| **프록시** | localhost:6666 | **localhost:9090** |
| **Kakao URI** | http://localhost:3000/auth/callback | **http://localhost:5173/auth/callback** |

### 백엔드
| 설정 | 변경 전 | 변경 후 |
|------|--------|--------|
| **CORS Origin** | http://localhost:3001 | **http://localhost:5173** |

---

## 📋 파일 변경 사항

```
✅ frontend/.env.example          → 올바른 값 + 프로덕션 참고용 주석
✅ frontend/vite.config.js        → 포트 5173, 프록시 9090
✅ application-local.yml          → CORS allowed-origins 5173
✅ CHANGELOG.md                   → 변경 내역 기록
✅ docs/environment-setup.md      → 📚 환경 설정 완벽 가이드
✅ docs/render-deployment.md      → 📚 배포 가이드
```

---

## 🌐 프로덕션 배포 준비 (Render)

### 1단계: Render 백엔드 환경 변수 설정
```
Render Dashboard → jsk-schedule-backend → Environment
추가:
KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
KAKAO_CLIENT_SECRET=[시크릿]
KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback
```

### 2단계: Render 프론트엔드 환경 변수 설정
```
Render Dashboard → jsk-schedule-frontend → Environment
추가:
VITE_KAKAO_CLIENT_ID=240f33554023d9ab4957b2d638fb0d71
VITE_KAKAO_REDIRECT_URI=https://jsk-schedule-frontend.onrender.com/auth/callback
VITE_API_BASE_URL=https://jsk-schedule-backend.onrender.com
```

### 3단계: 배포 실행
```
1. Render 환경 변수 저장
2. "Clear Build Cache & Deploy" 클릭
3. 배포 완료 대기 (5-10분)
4. https://jsk-schedule-frontend.onrender.com 방문하여 로그인 테스트
```

---

## ✅ 체크리스트

### 로컬 테스트
- [ ] 백엔드 포트 9090에서 실행 중
- [ ] 프론트엔드 포트 5173에서 실행 중
- [ ] "카카오로 시작하기" 클릭 가능
- [ ] 로그인 후 캘린더 페이지 표시
- [ ] 일정 생성/수정/삭제 작동

### 프로덕션 배포
- [ ] Render 백엔드 환경 변수 설정
- [ ] Render 프론트엔드 환경 변수 설정
- [ ] Kakao 콘솔에 Redirect URI 등록
  - [ ] http://localhost:5173/auth/callback
  - [ ] https://jsk-schedule-frontend.onrender.com/auth/callback
- [ ] Render 배포 완료
- [ ] 프로덕션 로그인 테스트 성공

---

## 🐛 문제 해결

### "카카오로 시작하기 후 에러"
→ `docs/environment-setup.md` 트러블슈팅 섹션 참고

### 포트 충돌
```bash
netstat -ano | findstr :5173  # 확인
# 프로세스 종료 후 재시작
```

### 프로덕션 로그인 실패
→ `docs/render-deployment.md`의 배포 검증 섹션 참고

---

## 📚 상세 가이드

- **전체 환경 설정**: `docs/environment-setup.md`
- **Render 배포**: `docs/render-deployment.md`
- **완전한 요약**: `ENVIRONMENT_SETUP_SUMMARY.md`

---

## 💡 핵심 포인트

1. **로컬**: 프론트엔드 5173 + 백엔드 9090
2. **프로덕션**: 모든 환경 변수가 Render에 설정되어야 함
3. **Kakao**: 로컬 + 프로덕션 Redirect URI 모두 등록 필수
4. **배포**: 환경 변수 변경 후 "Clear Build Cache & Deploy" 실행 필수

---

**궁금한 점? 상세 가이드 문서를 참고하세요!** 📖

