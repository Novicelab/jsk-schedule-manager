import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'

const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${
  import.meta.env.VITE_KAKAO_CLIENT_ID
}&redirect_uri=${
  import.meta.env.VITE_KAKAO_REDIRECT_URI
}&response_type=code`

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFormMode, setIsFormMode] = useState(false)

  useEffect(() => {
    // 이미 로그인된 상태면 메인으로 이동
    const token = localStorage.getItem('accessToken')
    if (token) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL
  }

  const handleCredentialLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      })

      const { accessToken, refreshToken, user } = response.data

      // 토큰과 사용자 정보 저장
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(user))

      // 메인 페이지로 이동
      navigate('/', { replace: true })
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        '로그인에 실패했습니다. 사용자명과 비밀번호를 확인하세요.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">JSK 일정 관리</h1>
        <p className="login-subtitle">팀 중심의 스마트한 일정 관리 서비스</p>

        {!isFormMode ? (
          <>
            <button className="btn-kakao" onClick={handleKakaoLogin}>
              카카오로 시작하기
            </button>
            <div className="login-divider">
              <span>또는</span>
            </div>
            <button
              className="btn-credential-login"
              onClick={() => setIsFormMode(true)}
            >
              ID/비밀번호로 로그인
            </button>
          </>
        ) : (
          <form className="login-form" onSubmit={handleCredentialLogin}>
            {error && <div className="login-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="username" className="form-label">
                사용자명
              </label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="사용자명을 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-login-submit"
              disabled={loading || !username || !password}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <button
              type="button"
              className="btn-back-to-kakao"
              onClick={() => {
                setIsFormMode(false)
                setError('')
                setUsername('')
                setPassword('')
              }}
              disabled={loading}
            >
              ← 이전으로
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default LoginPage
