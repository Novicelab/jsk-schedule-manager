import { useNavigate } from 'react-router-dom'

function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <h1 className="not-found-code">404</h1>
        <p className="not-found-message">페이지를 찾을 수 없습니다.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          메인으로 돌아가기
        </button>
      </div>
    </div>
  )
}

export default NotFoundPage
