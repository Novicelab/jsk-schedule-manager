import { useState } from 'react'
import { enablePush, snoozePrompt } from '../../lib/push'
import './PushPermissionSheet.css'

/**
 * 웹 푸시 동의 요청 바텀시트.
 *
 * mode
 *  - 'ask'         : 일반 권한 요청 (Android / PC / 홈화면 추가된 iOS)
 *  - 'ios-install' : iOS Safari 일반 탭 — 홈 화면 추가 안내 (권한 요청 자체가 불가)
 *
 * 권한 요청은 반드시 사용자 클릭에서 출발해야 하므로
 * 시트를 띄우기만 하고 자동으로 requestPermission()을 호출하지 않는다.
 */
function PushPermissionSheet({ mode = 'ask', onClose, onGranted }) {
  const [working, setWorking] = useState(false)
  const [failure, setFailure] = useState(null) // 'denied' | 'error' | null
  const [errorMessage, setErrorMessage] = useState('')

  const handleLater = () => {
    snoozePrompt()
    onClose()
  }

  const handleEnable = async () => {
    setWorking(true)
    setFailure(null)
    try {
      const result = await enablePush()
      if (result.ok) {
        onGranted?.()
        onClose()
        return
      }
      if (result.reason === 'denied') {
        setFailure('denied')
      } else if (result.reason === 'default') {
        // 사용자가 브라우저 팝업을 그냥 닫음 — 다음에 다시 물어볼 수 있다
        snoozePrompt()
        onClose()
      } else {
        setFailure('error')
        setErrorMessage(
          result.reason === 'misconfigured'
            ? '알림 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.'
            : '이 브라우저는 알림을 지원하지 않습니다.'
        )
      }
    } catch (err) {
      console.error('푸시 알림 설정 실패:', err)
      setFailure('error')
      setErrorMessage(err.message || '알림 설정 중 오류가 발생했습니다.')
    } finally {
      setWorking(false)
    }
  }

  const isIOSGuide = mode === 'ios-install'

  return (
    <div className="push-sheet-overlay" onClick={handleLater}>
      <div
        className="push-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-sheet-title"
      >
        <div className="push-sheet-grip" aria-hidden="true" />

        <div className="push-sheet-body">
          <div className="push-sheet-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
              <path d="M10.3 20a2 2 0 0 0 3.4 0" />
            </svg>
          </div>

          {isIOSGuide ? (
            <>
              <h3 id="push-sheet-title" className="push-sheet-title">
                홈 화면에 추가하면 알림을 받을 수 있어요
              </h3>
              <p className="push-sheet-desc">
                아이폰은 홈 화면에 추가한 뒤에만 알림을 받을 수 있습니다.
                아래 순서대로 한 번만 설정해주세요.
              </p>

              <ol className="push-sheet-steps">
                <li>
                  <span className="push-step-num">1</span>
                  <span>화면 아래 <b>공유 버튼</b>을 누릅니다</span>
                </li>
                <li>
                  <span className="push-step-num">2</span>
                  <span><b>홈 화면에 추가</b>를 선택합니다</span>
                </li>
                <li>
                  <span className="push-step-num">3</span>
                  <span>홈 화면에 생긴 <b>아이콘으로 다시 열어주세요</b></span>
                </li>
              </ol>
            </>
          ) : (
            <>
              <h3 id="push-sheet-title" className="push-sheet-title">
                일정 알림을 받으시겠어요?
              </h3>
              <p className="push-sheet-desc">
                다른 사람이 일정을 등록하거나 변경하면 이 기기로 바로 알려드립니다.
                직접 등록한 일정은 알림이 오지 않습니다.
              </p>

              {failure === 'denied' ? (
                <div className="push-sheet-alert">
                  알림이 차단되어 있습니다. 브라우저 주소창의 자물쇠 아이콘을 눌러
                  <b> 알림을 &lsquo;허용&rsquo;</b>으로 바꾼 뒤 다시 시도해주세요.
                </div>
              ) : failure === 'error' ? (
                <div className="push-sheet-alert">{errorMessage}</div>
              ) : (
                <p className="push-sheet-hint">
                  버튼을 누르면 브라우저가 한 번 더 확인합니다. <b>허용</b>을 선택해주세요.
                </p>
              )}
            </>
          )}
        </div>

        <div className="push-sheet-footer">
          {isIOSGuide ? (
            <button type="button" className="push-btn push-btn-primary" onClick={handleLater}>
              알겠습니다
            </button>
          ) : (
            <>
              <button
                type="button"
                className="push-btn push-btn-ghost"
                onClick={handleLater}
                disabled={working}
              >
                나중에
              </button>
              <button
                type="button"
                className="push-btn push-btn-primary"
                onClick={handleEnable}
                disabled={working}
              >
                {working ? '설정 중...' : failure === 'denied' ? '다시 시도' : '알림 받기'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PushPermissionSheet
