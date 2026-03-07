import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cleanupSession } from '../lib/sessionCleanup'

const useAuth = () => {
  const navigate = useNavigate()

  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    try {
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Supabase Auth 세션 감지
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
      if (!session) {
        setUser(null)
        localStorage.removeItem('user')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = useCallback(async () => {
    try {
      // 로그아웃 플래그 설정 (LoginPage의 자동 리다이렉트 방지)
      sessionStorage.setItem('_just_logged_out', 'true')

      await supabase.auth.signOut()
    } catch (err) {
      console.error('로그아웃 실패:', err)
    } finally {
      // 모든 세션 및 저장소 완전 초기화
      cleanupSession()
      setUser(null)
      setIsLoggedIn(false)

      // 페이지 새로고침으로 메모리 초기화 (Navbar와 동일)
      setTimeout(() => {
        window.location.href = '/login'
      }, 100)
    }
  }, [])

  return { user, isLoggedIn, logout }
}

export default useAuth
