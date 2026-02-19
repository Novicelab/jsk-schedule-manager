import { Navigate } from 'react-router-dom'

// localStorage에 accessToken이 없으면 /login으로 리다이렉트
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('accessToken')
  return token ? children : <Navigate to="/login" replace />
}

export default PrivateRoute
