function LoadingPopup({ isOpen, message = '로딩 중...' }) {
  if (!isOpen) return null

  return (
    <div className="loading-popup-overlay">
      <div className="loading-popup-content">
        <div className="loading-spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  )
}

export default LoadingPopup
