import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        로딩 중...
      </div>
    )
  }

  return session ? children : <Navigate to="/login" replace />
}

export default PrivateRoute
