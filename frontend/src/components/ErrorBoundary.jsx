import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
        }}>
          <h2 style={{ marginBottom: '12px', color: '#333' }}>
            오류가 발생했습니다
          </h2>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            페이지를 새로고침해주세요.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 24px',
              backgroundColor: '#9c27b0',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            홈으로 이동
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
