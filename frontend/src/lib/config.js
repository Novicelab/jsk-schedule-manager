/**
 * 백엔드 URL 동적 결정
 * 1. 환경변수가 있으면 사용
 * 2. 프로덕션(Render)에서는 자동으로 Render 백엔드 사용
 * 3. 로컬 개발은 localhost:3001 사용
 */
export const getBackendUrl = () => {
  // Step 1: 환경변수 확인
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.trim()
  }

  // Step 2: 프로덕션 자동 감지
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname

    // Render 프로덕션
    if (hostname.includes('onrender.com') || hostname.includes('jsk-schedule-frontend')) {
      return 'https://jsk-schedule-backend.onrender.com'
    }

    // GitHub Pages 등 다른 프로덕션
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return 'https://jsk-schedule-backend.onrender.com'
    }
  }

  // Step 3: 기본값 (로컬 개발)
  return 'http://localhost:3001'
}
