import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import NotificationSettings from '../components/settings/NotificationSettings'

function MyPage() {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="mypage-main">
        <div className="mypage-container">
          <div className="mypage-header">
            <button className="btn btn-back" onClick={handleBack}>
              &larr; 뒤로가기
            </button>
            <h2 className="mypage-title">마이페이지</h2>
          </div>

          <div className="mypage-section">
            <NotificationSettings />
          </div>
        </div>
      </main>
    </div>
  )
}

export default MyPage
