import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'

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

  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem('accessToken')
  )

  const login = useCallback((accessToken, refreshToken, userData) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setIsLoggedIn(true)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken })
      }
    } catch (err) {
      // 로그아웃 API 실패해도 로컬 상태는 반드시 초기화
      console.error('로그아웃 API 호출 실패:', err)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      setUser(null)
      setIsLoggedIn(false)
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return { user, isLoggedIn, login, logout }
}

export default useAuth
