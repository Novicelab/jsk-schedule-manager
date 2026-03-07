import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingPopup from './LoadingPopup'

const PrivateRoute = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 세션 변경 감지 (로그아웃, 토큰 만료 등)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <LoadingPopup isOpen={true} message="세션 확인 중..." />
  }

  // 세션 없으면 /login으로 이동 (SPA 내부 라우팅)
  // 로그아웃 시 강제 새로고침은 Navbar에서 단독 처리하므로 여기서는 경합 없음
  return session ? children : <Navigate to="/login" replace />
}

export default PrivateRoute
