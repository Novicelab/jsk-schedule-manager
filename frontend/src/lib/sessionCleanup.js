/**
 * 세션 및 저장소 완전 초기화 유틸리티
 * 로그아웃 또는 인증 실패 시 호출하여 모든 세션 정보를 정리합니다.
 */

/**
 * Supabase 프로젝트 ID 추출 (VITE_SUPABASE_URL에서)
 * https://xxxxx.supabase.co → xxxxx
 */
const getSupabaseProjectId = () => {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  if (!url) {
    console.warn('VITE_SUPABASE_URL이 설정되지 않음')
    return null
  }
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  return match ? match[1] : null
}

export const cleanupSession = () => {
  console.log('=== 세션 완전 초기화 시작 ===')

  // 1. localStorage 정리: 사용자 정보 (표시용)
  localStorage.removeItem('user')
  console.log('✓ localStorage.user 제거')

  // 2. localStorage 정리: Supabase Auth 토큰 (중요)
  // Supabase JS 클라이언트가 저장하는 모든 인증 관련 localStorage 키
  // 이 토큰들을 남겨두면 로그아웃 후에도 자동 로그인될 수 있음
  const projectId = getSupabaseProjectId()
  if (projectId) {
    const supabaseAuthKeys = [
      `sb-${projectId}-auth-token`,
      `sb-${projectId}-auth-token.2`,
      `sb-${projectId}-auth-state`,
      `sb-${projectId}-auth-code-verifier`,
      `sb-${projectId}-auth-pkce`,
    ]
    supabaseAuthKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✓ localStorage.${key} 제거`)
    })
  } else {
    console.warn('Supabase 프로젝트 ID를 추출할 수 없어 auth 토큰 정리 불가')
  }

  // 3. sessionStorage 정리: OAuth 관련
  sessionStorage.removeItem('kakao_oauth_state')
  console.log('✓ sessionStorage.kakao_oauth_state 제거')

  // 4. sessionStorage 정리: iOS bfcache 이중 실행 방지 플래그
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
    console.log(`✓ sessionStorage.${key} 제거`)
  })

  // 5. 브라우저 캐시 정리 (필요시)
  // IndexedDB에도 Supabase 데이터가 저장될 수 있음
  if (projectId && window.indexedDB) {
    try {
      const supabaseDbName = `sb_${projectId}_realtime` // 예시
      const request = window.indexedDB.deleteDatabase(supabaseDbName)
      request.onsuccess = () => {
        console.log(`✓ IndexedDB(${supabaseDbName}) 삭제`)
      }
      request.onerror = () => {
        console.log(`⚠ IndexedDB(${supabaseDbName}) 삭제 실패 (문제 없음)`)
      }
    } catch (err) {
      console.log('⚠ IndexedDB 정리 중 에러 (무시):', err.message)
    }
  }

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
