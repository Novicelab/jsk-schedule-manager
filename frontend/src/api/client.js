import axios from 'axios'

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  // 프로덕션 환경 (Render)
  if (import.meta.env.PROD) {
    return 'https://jsk-schedule-backend.onrender.com/api'
  }
  // 로컬 개발 환경
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090/api'
}

const apiClient = axios.create({
  baseURL: getBackendUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// 토큰 재발급 중복 요청 방지 플래그
let isRefreshing = false
let pendingRequests = []

const processPendingRequests = (error, token = null) => {
  pendingRequests.forEach((callback) => {
    if (error) {
      callback.reject(error)
    } else {
      callback.resolve(token)
    }
  })
  pendingRequests = []
}

// 요청 인터셉터: accessToken 자동 주입
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken')
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 응답 인터셉터: 401 시 토큰 재발급 후 원래 요청 재시도
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 401이 아니거나 재발급 API 자체의 실패면 바로 reject
    if (
      error.response?.status !== 401 ||
      originalRequest.url === '/auth/reissue' ||
      originalRequest._retried
    ) {
      if (error.response?.status === 401) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        // 로그인 페이지가 아닐 때만 리다이렉트
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }

    originalRequest._retried = true

    if (isRefreshing) {
      // 이미 재발급 중이면 완료될 때까지 대기
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject })
      })
        .then((newAccessToken) => {
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
          return apiClient(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    isRefreshing = true
    const refreshToken = localStorage.getItem('refreshToken')

    if (!refreshToken) {
      isRefreshing = false
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    try {
      const response = await axios.post(`${getBackendUrl()}/auth/reissue`, { refreshToken })
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        response.data.data

      localStorage.setItem('accessToken', newAccessToken)
      localStorage.setItem('refreshToken', newRefreshToken)

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`

      processPendingRequests(null, newAccessToken)

      return apiClient(originalRequest)
    } catch (reissueError) {
      processPendingRequests(reissueError, null)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(reissueError)
    } finally {
      isRefreshing = false
    }
  }
)

export default apiClient
