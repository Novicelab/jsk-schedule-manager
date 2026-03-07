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

  if (!session) {
    // 세션 만료/로그아웃 시 강제 페이지 새로고침으로 이동
    // (SPA 내부 navigate 사용 시 메모리 상태가 남아있을 수 있으므로 제거)
    // LoginPage의 _just_logged_out 플래그와의 경합을 피하기 위해
    // window.location.href 사용 (강제 새로고침)
    setTimeout(() => {
      window.location.href = '/login'
    }, 0)
    return <LoadingPopup isOpen={true} message="로그인이 필요합니다..." />
  }

  return children
}

export default PrivateRoute
