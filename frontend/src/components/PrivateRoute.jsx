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

    // 세션 변경 감지: SIGNED_OUT 이벤트에만 세션 제거
    // TOKEN_REFRESHED, INITIAL_SESSION 등 정상 이벤트에서는 기존 세션 유지
    // 카카오톡 인앱 브라우저 백키 시 일시적 이벤트 발생으로 인한 무한 리렌더링 방지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setLoading(false)
      } else if (session) {
        setSession(session)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <LoadingPopup isOpen={true} message="세션 확인 중..." />
  }

  return session ? children : <Navigate to="/login" replace />
}

export default PrivateRoute
