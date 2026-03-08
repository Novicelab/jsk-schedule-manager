# 🚀 지금 바로 배포하기 (프로덕션)

**준비 상태**: ✅ 완료
**커밋**: 6f3d642 (main 브랜치)
**배포 시간**: 약 15-20분

---

## 📌 현재 상태 요약

```
✅ 로컬 설정: 모두 수정 완료
✅ 코드 변경: 모두 커밋 완료
✅ 문서화: 완벽히 작성 완료
✅ GitHub: 푸시 완료

⏳ 다음 단계: Render 환경 변수 설정만 남음
```

---

## 🎯 배포 가이드 (복사-붙여넣기 친화적)

### **[1단계] Render 백엔드 환경 변수 설정**

1. **Render 대시보드 열기**
   ```
   https://dashboard.render.com
   ```

2. **Backend 서비스 선택**
   ```
   jsk-schedule-backend 클릭
   ```

3. **Environment 탭 이동**
   ```
   Settings → Environment (탭)
   ```

4. **다음 변수 추가/수정**
   ```
   변수명: KAKAO_CLIENT_ID
   값: 240f33554023d9ab4957b2d638fb0d71
   ───────────────────────────────────────

   변수명: KAKAO_CLIENT_SECRET
   값: [기존 값 유지 - 변경하지 말 것]
   ───────────────────────────────────────

   변수명: KAKAO_REDIRECT_URI
   값: https://jsk-schedule-frontend.onrender.com/auth/callback
   ───────────────────────────────────────

   변수명: APP_CORS_ALLOWED_ORIGINS
   값: https://jsk-schedule-frontend.onrender.com
   ───────────────────────────────────────
   ```

5. **"Save Changes" 클릭**
   ✅ 완료

---

### **[2단계] Render 프론트엔드 환경 변수 설정**

1. **Frontend 서비스 선택**
   ```
   jsk-schedule-frontend 클릭
   ```

2. **Environment 탭 이동**
   ```
   Settings → Environment (탭)
   ```

3. **다음 변수 추가/수정**
   ```
   변수명: VITE_KAKAO_CLIENT_ID
   값: 240f33554023d9ab4957b2d638fb0d71
   ───────────────────────────────────────

   변수명: VITE_KAKAO_REDIRECT_URI
   값: https://jsk-schedule-frontend.onrender.com/auth/callback
   ───────────────────────────────────────

   변수명: VITE_API_BASE_URL
   값: https://jsk-schedule-backend.onrender.com
   ───────────────────────────────────────
   ```

4. **"Save Changes" 클릭**
   ✅ 완료

---

### **[3단계] 프론트엔드 재배포 (중요!)**

1. **Frontend 서비스 대시보드로 이동**
   ```
   https://dashboard.render.com → jsk-schedule-frontend
   ```

2. **"Clear Build Cache & Deploy" 버튼 클릭**
   ```
   이 버튼을 반드시 클릭해야 새 환경 변수가 적용됨!
   ```

3. **배포 대기**
   ```
   Logs 탭에서 진행 상황 확인
   약 5-10분 소요

   완료 시 표시: "Successfully deployed"
   상태: "Running" (초록색)
   ```

---

### **[4단계] 백엔드 재배포 (선택사항이지만 권장)**

1. **Backend 서비스 대시보드로 이동**
   ```
   https://dashboard.render.com → jsk-schedule-backend
   ```

2. **"Manual Deploy" 버튼 클릭**
   ```
   환경 변수 변경을 적용하기 위해
   ```

3. **배포 대기**
   ```
   Logs 탭에서 진행 상황 확인
   약 3-5분 소요

   완료 시 표시: 마지막 배포 시간 업데이트
   상태: "Live" (초록색)
   ```

---

## ✅ 배포 검증 (필수!)

### **1️⃣ 프론트엔드 접속 확인**
```
1. 브라우저 열기
2. https://jsk-schedule-frontend.onrender.com 접속
3. 페이지가 정상적으로 로드되는지 확인

✅ 성공: 로그인 페이지가 보임
❌ 실패: 에러 또는 로딩 중 화면
```

### **2️⃣ 백엔드 헬스 체크**
```
curl https://jsk-schedule-backend.onrender.com/health

✅ 성공: 200 응답 또는 "UP" 메시지
❌ 실패: 502/503 에러 또는 연결 불가
```

### **3️⃣ 환경 변수 확인** (중요!)
```
1. https://jsk-schedule-frontend.onrender.com 접속
2. 브라우저 개발자 도구 열기 (F12)
3. Console 탭 클릭
4. 다음 명령어 입력:
   console.log(import.meta.env.VITE_API_BASE_URL)
   console.log(import.meta.env.VITE_KAKAO_REDIRECT_URI)

✅ 성공:
   https://jsk-schedule-backend.onrender.com
   https://jsk-schedule-frontend.onrender.com/auth/callback

❌ 실패: localhost가 표시되면 캐시 문제
해결: [3단계]에서 "Clear Build Cache & Deploy" 다시 실행
```

### **4️⃣ 카카오 로그인 테스트** (최종 검증!)
```
1. https://jsk-schedule-frontend.onrender.com 접속
2. "카카오로 시작하기" 클릭
3. Kakao 인증 페이지 → 승인
4. 신규 사용자면 이름 입력
5. "확인" 클릭

✅ 성공: 캘린더 페이지 표시
❌ 실패: 에러 페이지

만약 실패:
- 브라우저 개발자 도구에서 에러 메시지 확인
- DEPLOYMENT_CHECKLIST.md의 트러블슈팅 참고
```

---

## 🎯 배포 타임라인

| 단계 | 시간 | 체크 |
|------|------|------|
| 백엔드 환경 변수 설정 | 1분 | ☐ |
| 프론트엔드 환경 변수 설정 | 1분 | ☐ |
| 프론트엔드 재배포 | 5-10분 | ☐ |
| 백엔드 재배포 | 3-5분 | ☐ |
| 배포 검증 | 2분 | ☐ |
| **총 시간** | **15-20분** | ☐ |

---

## 🔗 필요한 링크

| 링크 | 용도 |
|------|------|
| https://dashboard.render.com | Render 대시보드 |
| https://jsk-schedule-frontend.onrender.com | 프로덕션 프론트엔드 |
| https://jsk-schedule-backend.onrender.com | 프로덕션 백엔드 API |
| https://developers.kakao.com | Kakao 콘솔 (참고용) |

---

## 📋 체크리스트

### 배포 전
- [x] 코드 변경 완료
- [x] Git 커밋 및 푸시 완료
- [x] 모든 문서 작성 완료
- [ ] Render 대시보드 접근 확인

### 배포 중
- [ ] 백엔드 환경 변수 설정
- [ ] 프론트엔드 환경 변수 설정
- [ ] 프론트엔드 "Clear Build Cache & Deploy" 실행
- [ ] 프론트엔드 배포 완료 확인 (Logs에서)
- [ ] 백엔드 "Manual Deploy" 실행
- [ ] 백엔드 배포 완료 확인 (Logs에서)

### 배포 후
- [ ] 프론트엔드 접속 확인
- [ ] 백엔드 헬스 체크
- [ ] 프론트엔드 환경 변수 확인 (콘솔)
- [ ] 카카오 로그인 테스트
- [ ] ✅ **배포 완료!**

---

## 🆘 문제 해결

### "프론트엔드가 여전히 localhost를 사용"
```
해결: Step 3에서 "Clear Build Cache & Deploy" 다시 실행
(Render가 캐시를 완전히 지울 때까지 5-10분 기다림)
```

### "카카오 로그인이 작동하지 않음"
```
확인사항:
1. KAKAO_REDIRECT_URI 값이 정확한지 확인
   값: https://jsk-schedule-frontend.onrender.com/auth/callback
   (http 아니고 https여야 함!)

2. VITE_KAKAO_REDIRECT_URI도 동일한지 확인

3. 콘솔에서 환경 변수 확인:
   console.log(import.meta.env.VITE_KAKAO_REDIRECT_URI)

4. 백엔드 로그 확인:
   Render Dashboard → jsk-schedule-backend → Logs
```

### "배포 중 에러 발생"
```
1. Render Dashboard에서 Logs 확인
2. 에러 메시지 검색
3. DEPLOYMENT_CHECKLIST.md의 트러블슈팅 참고
```

---

## 📞 지원 문서

**배포 중 문제 발생 시 참고:**
- `DEPLOYMENT_CHECKLIST.md`: 상세 배포 체크리스트
- `docs/render-deployment.md`: 완벽한 배포 가이드
- `docs/environment-setup.md`: 환경 설정 가이드

---

## 🎉 배포 완료 후

```
✅ 프로덕션 서비스 시작!
   - 프론트엔드: https://jsk-schedule-frontend.onrender.com
   - 백엔드: https://jsk-schedule-backend.onrender.com

✅ 사용자가 카카오로 로그인 가능
✅ 일정 CRUD 작동 중
✅ 모든 기능 정상 작동
```

---

**지금 바로 시작하세요!** 🚀

위 단계를 따라 Render 대시보드에서 환경 변수만 설정하고 배포하면 됩니다.
모든 코드와 문서는 이미 준비되어 있습니다!

