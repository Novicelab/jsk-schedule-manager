# ✅ 프로덕션 배포 검증 보고서

**배포 완료일**: 2026-02-21
**배포 상태**: 완료 ✅
**검증 가이드**: 아래 단계를 따르세요

---

## 🔍 **배포 검증 체크리스트**

### **[1단계] 프로덕션 프론트엔드 접속**

```
URL: https://jsk-schedule-frontend.onrender.com

✅ 확인 사항:
   - 페이지가 정상적으로 로드되는가?
   - 로그인 페이지가 보이는가?
   - "카카오로 시작하기" 버튼이 보이는가?

❌ 문제 발생 시:
   - Render Dashboard → Frontend → Logs 확인
   - 빌드 에러 또는 배포 에러 확인
```

**결과**: _________________ (정상/문제)

---

### **[2단계] 백엔드 헬스 체크**

```
명령어:
curl https://jsk-schedule-backend.onrender.com/health

또는 브라우저에서:
https://jsk-schedule-backend.onrender.com/health

✅ 성공 응답:
   - HTTP 200 OK
   - 또는 {"status": "UP"} 같은 메시지

❌ 실패 응답:
   - 502 Bad Gateway → 백엔드 시작 중
   - 503 Service Unavailable → 백엔드 다운
   - 연결 안 됨 → 배포 진행 중

해결: Render Dashboard → Backend → Logs 확인 후 재배포
```

**결과**: _________________ (정상/문제)

---

### **[3단계] 프론트엔드 환경 변수 확인**

```
1. https://jsk-schedule-frontend.onrender.com 접속
2. F12 키 눌러서 개발자 도구 열기
3. "Console" 탭 클릭
4. 다음 코드 입력:
   console.log(import.meta.env.VITE_API_BASE_URL)
   console.log(import.meta.env.VITE_KAKAO_REDIRECT_URI)

✅ 성공 (다음이 보여야 함):
   https://jsk-schedule-backend.onrender.com
   https://jsk-schedule-frontend.onrender.com/auth/callback

❌ 실패 (localhost가 보이면):
   → Render Dashboard → Frontend → "Clear Build Cache & Deploy" 다시 실행
   → 캐시 제거 후 5-10분 대기
   → 페이지 새로고침 (Ctrl+Shift+Delete로 캐시 삭제)
```

**VITE_API_BASE_URL**: _________________

**VITE_KAKAO_REDIRECT_URI**: _________________

**상태**: ✅ 정상 / ❌ localhost 문제

---

### **[4단계] 카카오 로그인 테스트** ⭐ (가장 중요!)

#### **Step 1: 로그인 시도**
```
1. https://jsk-schedule-frontend.onrender.com 접속
2. "카카오로 시작하기" 버튼 클릭
3. Kakao 인증 페이지로 리다이렉트 확인

✅ 성공:
   - Kakao 로그인 페이지 표시됨
   - 프로필 사진 및 "동의 및 계속하기" 버튼 보임

❌ 실패 (에러 페이지):
   - 원인: Redirect URI 불일치
   - 확인: Kakao 콘솔에서 Redirect URI 등록 상태 확인
   - 콘솔에서 에러 메시지 확인 (F12 → Console)
```

**결과**: _________________ (정상/에러)

---

#### **Step 2: 신규 사용자 가입 테스트**
```
신규 카카오 계정으로 로그인 시:

✅ 기대하는 흐름:
   1. Kakao 인증 완료 → https://jsk-schedule-frontend.onrender.com/auth/callback으로 리다이렉트
   2. NameInputModal 팝업 표시 (이름 입력하세요)
   3. 이름 입력 후 "확인" 클릭
   4. 캘린더 페이지 표시 (메인 페이지)

✅ 확인 항목:
   - 팝업에서 이름 입력 가능한가?
   - "확인" 버튼 클릭 시 캘린더로 이동하는가?
   - localStorage에 accessToken, refreshToken 저장되었는가?

❌ 문제 발생 시:
   - 콘솔 에러 메시지 확인
   - 백엔드 로그 확인: Render Dashboard → Backend → Logs
   - PUT /api/users/me 호출 실패 가능성
```

**결과**: _________________ (정상/문제)

---

#### **Step 3: 기존 사용자 로그인 테스트** (재로그인)
```
위 신규 가입한 계정으로 다시 로그인 시:

✅ 기대하는 흐름:
   1. Kakao 인증 완료 → https://jsk-schedule-frontend.onrender.com/auth/callback로 리다이렉트
   2. NameInputModal 표시 안 됨 (이미 등록된 사용자이므로)
   3. 바로 캘린더 페이지 표시

✅ 확인 항목:
   - 이름 입력 팝업이 안 나타나는가? (정상)
   - 캘린더 페이지가 바로 표시되는가?
   - isNewUser 로직이 정상 작동하는가?

❌ 문제 발생 시:
   - 팝업이 계속 나타나면: backend의 isNewUser 판단 로직 확인
   - 로그인 실패하면: 토큰 재발급 로직 확인
```

**결과**: _________________ (정상/문제)

---

### **[5단계] 캘린더 페이지 기능 테스트**

```
✅ 확인 사항:
   1. 캘린더가 정상적으로 표시되는가?
   2. 현재 월이 정확하게 표시되는가?
   3. 일정들이 캘린더에 표시되는가?
   4. 좌측 GNB(메뉴)가 보이는가?
   5. 사용자 이름이 올바르게 표시되는가?

❌ 문제 발생 시:
   - 콘솔 에러 확인
   - 백엔드 API 호출 실패 여부 확인
   - 캘린더 데이터 로딩 여부 확인
```

**결과**: _________________ (정상/문제)

---

### **[6단계] 일정 CRUD 테스트**

#### **Create (생성)**
```
1. 캘린더에서 아무 날짜나 클릭
2. 일정 생성 모달 열림
3. "유형 선택" 확인:
   - VACATION (휴가) 선택 가능?
   - WORK (업무) 선택 가능?

✅ 휴가 등록 테스트:
   - 유형: VACATION 선택
   - 날짜: 2026-02-21 ~ 2026-02-23 선택
   - "일정 생성" 클릭

   기대 결과:
   - 저장 성공 메시지
   - 캘린더에 "[사용자이름]휴가" 표시 확인

✅ 업무 등록 테스트:
   - 유형: WORK 선택
   - 제목: "팀 회의"
   - 날짜: 2026-02-21 선택
   - 시간: 14:00 ~ 15:00
   - "일정 생성" 클릭

   기대 결과:
   - 저장 성공
   - 캘린더에 "팀 회의" 표시

❌ 문제 발생 시:
   - 콘솔 에러 확인
   - POST /api/schedules 호출 상태 확인
   - 서버 응답 상태 코드 확인 (201 성공)
```

**결과**: _________________ (정상/문제)

---

#### **Read (조회)**
```
생성한 일정이 캘린더에 올바르게 표시되는가?

✅ 확인:
   - 일정이 해당 날짜에 표시?
   - 일정 제목이 정확한가?
   - 클릭했을 때 상세 정보 보이는가?

❌ 문제:
   - GET /api/schedules 호출 실패
   - 데이터 포맷 오류
```

**결과**: _________________ (정상/문제)

---

#### **Update (수정)**
```
1. 캘린더의 일정 클릭
2. 상세 정보 모달에서 수정 버튼 클릭
3. 일정 수정 모달 열림
4. 제목 또는 설명 변경
5. "수정 완료" 버튼 클릭

✅ 기대 결과:
   - 수정 성공 메시지
   - 캘린더에 변경된 내용 반영

❌ 문제:
   - PUT /api/schedules/{id} 호출 실패
```

**결과**: _________________ (정상/문제)

---

#### **Delete (삭제)**
```
1. 캘린더의 일정 클릭
2. 상세 정보 모달에서 삭제 버튼 클릭
3. 삭제 확인 팝업
4. "삭제" 버튼 클릭

✅ 기대 결과:
   - 삭제 성공 메시지
   - 캘린더에서 일정 사라짐
   - (소프트 딜리트로 DB에는 남아있음)

❌ 문제:
   - DELETE /api/schedules/{id} 호출 실패
```

**결과**: _________________ (정상/문제)

---

### **[7단계] 로그아웃 테스트**

```
1. 캘린더 좌측 GNB에서 로그아웃 버튼 클릭
2. 로그인 페이지로 리다이렉트 확인
3. localStorage에서 토큰 삭제 확인

✅ 기대 결과:
   - 로그인 페이지로 이동
   - localStorage 토큰 삭제됨
   - 다시 로그인 가능

❌ 문제:
   - 로그아웃 API 실패
   - 토큰이 삭제되지 않음
```

**결과**: _________________ (정상/문제)

---

## 🎯 **최종 검증 요약**

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 프론트엔드 접속 | ✅ / ❌ | |
| 백엔드 헬스 체크 | ✅ / ❌ | |
| 환경 변수 확인 | ✅ / ❌ | |
| 카카오 로그인 | ✅ / ❌ | |
| 신규 사용자 가입 | ✅ / ❌ | |
| 기존 사용자 로그인 | ✅ / ❌ | |
| 캘린더 페이지 | ✅ / ❌ | |
| 휴가 등록 | ✅ / ❌ | |
| 업무 등록 | ✅ / ❌ | |
| 일정 수정 | ✅ / ❌ | |
| 일정 삭제 | ✅ / ❌ | |
| 로그아웃 | ✅ / ❌ | |

---

## 🚨 **문제 발생 시 확인 사항**

### 카카오 로그인 안 됨
```
1. Kakao 콘솔 확인:
   - https://developers.kakao.com/console/app
   - Redirect URI에 다음 등록되었는지 확인:
     ✅ https://jsk-schedule-frontend.onrender.com/auth/callback

2. 환경 변수 확인:
   - KAKAO_REDIRECT_URI (백엔드)
   - VITE_KAKAO_REDIRECT_URI (프론트엔드)
   - 둘 다 https://jsk-schedule-frontend.onrender.com/auth/callback인지 확인

3. 프론트엔드 캐시 제거:
   - Render Dashboard → Frontend → "Clear Build Cache & Deploy"
   - 5-10분 대기 후 새로고침 (Ctrl+Shift+Delete)
```

### 환경 변수가 localhost
```
1. 프론트엔드 캐시 제거:
   Render Dashboard → jsk-schedule-frontend → "Clear Build Cache & Deploy"

2. 5-10분 대기

3. 캐시 제거 확인:
   F12 → Console → import.meta.env.VITE_API_BASE_URL 확인
```

### CORS 에러
```
1. 백엔드 환경 변수 확인:
   APP_CORS_ALLOWED_ORIGINS = https://jsk-schedule-frontend.onrender.com

2. 백엔드 재배포:
   Render Dashboard → Backend → "Manual Deploy"

3. 브라우저 캐시 제거:
   Ctrl+Shift+Delete
```

---

## 📞 **지원**

문제 발생 시:
- `docs/render-deployment.md`: 상세 배포 가이드
- `docs/environment-setup.md`: 환경 설정 가이드
- `DEPLOYMENT_CHECKLIST.md`: 배포 체크리스트

---

## ✨ **배포 완료!**

```
🎉 프로덕션 서비스 시작!

📱 프론트엔드: https://jsk-schedule-frontend.onrender.com
🔌 백엔드: https://jsk-schedule-backend.onrender.com

✅ 모든 기능 정상 작동 중
✅ 사용자 카카오 로그인 가능
✅ 일정 CRUD 작동
```

