import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

/**
 * 브라우저 자체 '앱 설치' 배너 억제.
 *
 * Android/PC는 홈 화면에 설치하지 않아도 웹 푸시를 받을 수 있으므로
 * 설치를 권할 이유가 없다. 알림 동의는 앱 내 바텀시트로만 안내한다.
 *
 * iOS는 이 이벤트를 지원하지 않는다(Safari 미구현). 대신 홈 화면 추가가
 * 푸시 수신의 전제 조건이라, 별도 안내 시트로 처리한다.
 * -> components/push/PushPermissionSheet.jsx (mode: 'ios-install')
 *
 * React 마운트 전에 발생할 수 있어 모듈 최상단에서 등록한다.
 */
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
