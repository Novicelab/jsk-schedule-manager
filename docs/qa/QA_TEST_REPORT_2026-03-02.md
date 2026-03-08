# QA 테스트 보고서 (2026-03-02)

## 테스트 대상
세 가지 주요 버그 수정사항에 대한 내부 QA 테스트

| 버그 ID | 제목 | 수정 커밋 | 상태 |
|---------|------|----------|------|
| #1 | 알림 발송 - 폐기된 백엔드 호출 | 99560fd | 완료 |
| #2 | Navbar 사용자 이름 미업데이트 | 7a1c264 | 완료 |
| #3 | ScheduleDetail 타이머 중복 호출 | f65fd46 | 완료 |

---

## 1. 코드 검증 (Code Review)

### 1.1 알림 발송 버그 수정 (99560fd)

**파일 변경사항:**
- `frontend/src/components/schedule/ScheduleModal.jsx` ✅
- `frontend/src/components/schedule/ScheduleDetail.jsx` ✅

**코드 검증:**

```typescript
// BEFORE (폐기됨 - Spring Boot 백엔드)
const response = await fetch(`${backendUrl}/api/notify`, {...})

// AFTER (정상 - Supabase Edge Function)
const { data, error } = await supabase.functions.invoke('send-notification', {
  body: { scheduleId, userId, action, ... }
})
```

**검증 결과:** ✅ **PASS**
- ScheduleModal.jsx의 모든 알림 발송 호출이 Edge Function으로 변경됨
- ScheduleDetail.jsx의 모든 알림 발송 호출이 Edge Function으로 변경됨
- 기존 `getBackendUrl()` import 제거 완료
- Fire-and-forget 패턴으로 에러 로깅만 수행

**예상 동작:**
1. 일정 생성 → send-notification Edge Function 호출
2. 일정 수정 → send-notification Edge Function 호출
3. 일정 삭제 → send-notification Edge Function 호출
4. Network 탭에 supabase Edge Function 요청 표시
5. 카카오 알림톡 발송

---

### 1.2 Navbar 사용자 이름 업데이트 버그 (7a1c264)

**파일 변경사항:**
- `frontend/src/components/auth/NameInputModal.jsx` ✅
- `frontend/src/components/Navbar.jsx` ✅

**코드 검증:**

```typescript
// NameInputModal - CustomEvent 발행
window.dispatchEvent(new CustomEvent('userUpdated', {
  detail: { user: updatedUser }
}))

// Navbar - CustomEvent 리스너
const handleUserUpdated = (event) => {
  setUserName(event.detail.user.name)
}

useEffect(() => {
  window.addEventListener('userUpdated', handleUserUpdated)
  return () => window.removeEventListener('userUpdated', handleUserUpdated)
}, [])
```

**검증 결과:** ✅ **PASS**
- CustomEvent 발행 코드 정상 구현
- Navbar에 이벤트 리스너 정상 등록
- useEffect cleanup으로 메모리 누수 방지
- 기존 storage event 리스너 유지 (교차 탭 업데이트)

**예상 동작:**
1. 카카오 로그인 → NameInputModal 표시
2. 이름 입력 → 저장 (update-user-name Edge Function 호출)
3. CustomEvent('userUpdated') 발행
4. Navbar 즉시 이름 업데이트 (새로고침 없음)
5. 콘솔에 'User 업데이트 이벤트 발행' 로그

---

### 1.3 ScheduleDetail 타이머 버그 (f65fd46)

**파일 변경사항:**
- `frontend/src/components/schedule/ScheduleDetail.jsx` ✅

**코드 검증:**

```typescript
// useRef로 타이머 저장
const deleteTimerRef = useRef(null)

// 타이머 설정 시 ref에 저장
const handleDeleteSchedule = async (scheduleId) => {
  deleteTimerRef.current = setTimeout(() => {
    onDeleted()
  }, 1500)
}

// useEffect cleanup으로 언마운트 시 타이머 정리
useEffect(() => {
  return () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
      console.log('Timer cleared on unmount')
    }
  }
}, [])

// handleClose에서 명시적 정리
const handleClose = () => {
  if (deleteTimerRef.current) {
    clearTimeout(deleteTimerRef.current)
    console.log('Timer cleared on close')
  }
  onClose()
}
```

**검증 결과:** ✅ **PASS**
- useRef 사용으로 타이머 ID 저장
- useEffect cleanup 함수에서 unmount 시 타이머 정리
- handleClose에서 명시적 타이머 정리
- console.log로 디버깅 가능하도록 구현

**예상 동작:**
1. 일정 상세 페이지 열기
2. 삭제 버튼 클릭 → setTimeout(1500ms) 설정
3. 모달 닫기 → clearTimeout 호출 → "Timer cleared on close" 로그
4. onDeleted() 콜백 1회만 호출 (중복 없음)

---

## 2. 수동 QA 테스트 계획

### 테스트 환경 준비
```bash
1. Chrome 브라우저 열기
2. F12 (DevTools) 열기
3. Network 탭 + Console 탭 활성화
4. https://schedule.onrender.com 접속
```

---

### 테스트 Case 1: 알림 발송 기능

**시나리오 1-1: 신규 일정 생성 시 알림 발송**

```
전제: 카카오 로그인 완료, 팀 및 팀원 존재

1. 메인 페이지 → "일정 추가" 클릭
2. 일정 제목, 날짜, 시간 입력
3. "저장" 클릭
4. Network 탭 확인:
   ✅ 'send-notification' Edge Function 호출 확인
   ✅ Status: 200 OK
5. Console 탭 확인:
   ✅ '알림 발송 중...' 또는 관련 로그 표시
6. 카카오톡 앱 확인:
   ✅ 알림톡 수신 (약 2-3초 후)
```

**시나리오 1-2: 일정 수정 시 알림 발송**

```
전제: 기존 일정 존재

1. 일정 클릭 → 상세 페이지 열기
2. "수정" 버튼 클릭 또는 정보 수정
3. "저장" 클릭
4. Network 탭 확인:
   ✅ 'send-notification' Edge Function 호출 확인
   ✅ Status: 200 OK
5. 카카오톡 확인:
   ✅ 수정 알림톡 수신
```

**시나리오 1-3: 일정 삭제 시 알림 발송**

```
전제: 기존 일정 존재

1. 일정 클릭 → 상세 페이지 열기
2. "삭제" 버튼 클릭
3. 확인 대화상자에서 "삭제" 선택
4. Network 탭 확인:
   ✅ 'send-notification' Edge Function 호출 확인
   ✅ Status: 200 OK
5. 카카오톡 확인:
   ✅ 삭제 알림톡 수신
```

**기대 결과:**
- ❌ Spring Boot 백엔드 호출 없음
- ✅ Supabase Edge Function ('send-notification') 호출만 발생
- ✅ 모든 알림이 카카오톡으로 정상 발송

---

### 테스트 Case 2: Navbar 사용자 이름 업데이트

**시나리오 2-1: 신규 사용자 가입 시 Navbar 업데이트**

```
전제: 신규 카카오 계정 준비 (또는 로그아웃 후 진행)

1. 로그인 페이지 → "카카오로 시작하기" 클릭
2. Kakao 앱에서 로그인 (또는 신규 계정)
3. NameInputModal 표시됨
4. 이름 입력 (예: "홍길동")
5. "확인" 버튼 클릭
6. **즉시 확인:**
   ✅ Navbar의 사용자 이름 "홍길동" 표시 (새로고침 없음)
7. Console 탭 확인:
   ✅ 'User 업데이트 이벤트 발행' 또는 유사 로그
   ✅ CustomEvent 관련 로그
```

**시나리오 2-2: Navbar 이름 업데이트 후 페이지 새로고침**

```
전제: 위 시나리오 2-1 완료

1. F5 (새로고침) 수행
2. localStorage에서 사용자 정보 로드
3. Navbar의 사용자 이름 "홍길동" 유지 확인
4. Network 탭에서 로그인 재검증 확인
```

**기대 결과:**
- ✅ CustomEvent 발행으로 즉시 업데이트 (새로고침 불필요)
- ✅ localStorage 기반 영구 저장
- ✅ 콘솔에 CustomEvent 관련 로그 표시
- ❌ 중복 업데이트 없음

---

### 테스트 Case 3: ScheduleDetail 타이머 정리

**시나리오 3-1: 일정 삭제 후 콜백 중복 호출 확인**

```
전제: 기존 일정 존재

1. 일정 클릭 → 상세 페이지 열기
2. Console 탭 열기 (필터: 'onDeleted')
3. "삭제" 버튼 클릭
4. 삭제 확인 선택
5. **Console 확인:**
   ✅ onDeleted() 호출 로그 1회만 표시
   ✅ "Timer cleared on close" 또는 유사 로그
   ❌ onDeleted() 중복 호출 없음 (이전 버그)
6. 모달 닫기 (X 버튼 또는 background 클릭)
7. **Console 재확인:**
   ✅ onDeleted() 호출 횟수 변함 없음 (여전히 1회)
```

**시나리오 3-2: 모달 빠른 닫기**

```
전제: 일정 상세 페이지 열림

1. "삭제" 버튼 클릭
2. **즉시** (1.5초 이내) X 버튼으로 모달 닫기
3. Console 확인:
   ✅ "Timer cleared on close" 로그 표시
   ✅ onDeleted() 콜백 호출 안 됨 (타이머 정리됨)
4. 모달 완전히 닫혔는지 확인
```

**기대 결과:**
- ✅ onDeleted() 콜백 정확히 1회 호출 (중복 없음)
- ✅ useEffect cleanup으로 unmount 시 타이머 정리
- ✅ handleClose에서 명시적 정리
- ✅ 콘솔 로그로 타이머 정리 추적 가능
- ❌ 메모리 누수 없음

---

## 3. 테스트 체크리스트

### 알림 발송 테스트
- [ ] 일정 생성 시 Edge Function 호출 확인
- [ ] Network 탭에 'send-notification' 요청 표시
- [ ] 응답 Status 200 OK
- [ ] 카카오톡 생성 알림톡 수신
- [ ] 일정 수정 시 알림톡 수신
- [ ] 일정 삭제 시 알림톡 수신
- [ ] Spring Boot 백엔드 호출 없음 (폐기됨)

### Navbar 업데이트 테스트
- [ ] 신규 사용자 가입 후 NameInputModal 표시
- [ ] 이름 저장 후 Navbar 즉시 업데이트 (새로고침 없음)
- [ ] Console에 CustomEvent 발행 로그 표시
- [ ] 페이지 새로고침 후에도 이름 유지
- [ ] 중복 업데이트 없음

### 타이머 정리 테스트
- [ ] 일정 삭제 후 onDeleted() 콜백 1회 호출
- [ ] Console에 "Timer cleared" 로그 표시
- [ ] 모달 빠른 닫기 시 콜백 호출 안 됨
- [ ] 메모리 누수 없음 (DevTools Memory profiler로 검증 가능)

---

## 4. 발견된 이슈 & 결과

### 테스트 실행 방법

1. **로컬 개발 환경:**
   ```bash
   cd frontend
   npm run dev  # http://localhost:5173
   ```

2. **배포된 환경 (권장):**
   ```
   https://schedule.onrender.com
   ```

3. **DevTools 설정:**
   - F12 열기
   - Network 탭: "Fetch/XHR" 필터 활성화
   - Console 탭: 로그 메시지 모니터링

### 예상 이슈 및 해결 방법

| 이슈 | 원인 | 해결 방법 |
|------|------|---------|
| 알림톡 미수신 | Kakao API 키 만료/오류 | Supabase Log 확인 (Edge Function 실행 로그) |
| Navbar 미업데이트 | localStorage 동기화 지연 | 500ms 대기 후 확인 (이미 구현됨) |
| 타이머 중복 호출 | useRef cleanup 미적용 | Console 로그 확인, 코드 재검토 |
| CustomEvent 미발행 | 스크립트 에러 | Console 에러 메시지 확인 |

---

## 5. 최종 승인 & 배포

### 테스트 통과 조건
- ✅ 3가지 버그 모두 수정 확인
- ✅ 기존 기능 회귀 없음 (다른 기능 정상 동작)
- ✅ 콘솔 에러 없음
- ✅ Network 요청 정상

### 배포 상태
- **커밋**: f65fd46, 7a1c264, 99560fd
- **상태**: GitHub Push 완료 → Render 자동 배포 중
- **예상 배포 완료**: 2-3분

---

## 6. 테스트 결과 기록

| 테스트 항목 | 예상 결과 | 실제 결과 | 비고 |
|-----------|---------|---------|------|
| 알림 발송 - 생성 | Edge Function 호출 + 알림톡 | **수동 테스트 필요** | Kakao API 인증 필요 |
| 알림 발송 - 수정 | Edge Function 호출 + 알림톡 | **수동 테스트 필요** | Kakao API 인증 필요 |
| 알림 발송 - 삭제 | Edge Function 호출 + 알림톡 | **수동 테스트 필요** | Kakao API 인증 필요 |
| Navbar 업데이트 | 즉시 업데이트 + CustomEvent | **수동 테스트 필요** | OAuth 인증 필요 |
| 타이머 정리 | onDeleted() 1회 + 로그 | **수동 테스트 필요** | 실제 삭제 테스트 필요 |

---

## 🔍 검증 결과 요약

### 코드 검증 (Automated)
- ✅ **알림 발송**: Edge Function 호출 코드 정상
- ✅ **Navbar 업데이트**: CustomEvent 패턴 정상 구현
- ✅ **타이머 정리**: useRef + cleanup 정상 구현

### 수동 테스트 (Manual)
- 📋 **수동 테스트 계획 수립 완료**
- 📋 **테스트 시나리오 문서화 완료**
- ⏳ **실제 브라우저 테스트 필요** (Kakao OAuth, API 호출 검증)

---

**테스트 작성일**: 2026-03-02
**작성자**: QA Team (Internal)
**상태**: 코드 검증 완료, 수동 테스트 대기 중
