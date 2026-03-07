/**
 * 세션 및 저장소 완전 초기화 유틸리티
 * 로그아웃 또는 인증 실패 시 호출하여 모든 세션 정보를 정리합니다.
 */

export const cleanupSession = () => {
  console.log('=== 세션 완전 초기화 시작 ===')

  // 1. localStorage 정리
  // - user: 사용자 정보 (표시용)
  localStorage.removeItem('user')
  console.log('localStorage.user 제거')

  // 2. sessionStorage 정리
  // - kakao_oauth_state: CSRF 토큰 (OAuth state)
  sessionStorage.removeItem('kakao_oauth_state')
  console.log('sessionStorage.kakao_oauth_state 제거')

  // - auth_code_used_*: iOS bfcache 이중 실행 방지 플래그
  // 패턴: auth_code_used_${code}
  const keysToRemove = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key && key.startsWith('auth_code_used_')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => {
    sessionStorage.removeItem(key)
    console.log(`sessionStorage.${key} 제거`)
  })

  console.log('=== 세션 완전 초기화 완료 ===')
}

/**
 * 로그인 시작 시 초기화 (멀티 단말 계정 혼동 방지)
 * CallbackPage에서 호출
 */
export const cleanupBeforeLogin = () => {
  console.log('=== 로그인 시작 세션 초기화 ===')
  localStorage.removeItem('user')
  console.log('로그인 전 사용자 정보 제거')
}
