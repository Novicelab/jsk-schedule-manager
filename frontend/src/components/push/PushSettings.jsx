import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  needsIOSInstall,
  getPermission,
  hasActiveSubscription,
  enablePush,
  disablePush,
} from '../../lib/push'
import './PushSettings.css'

/**
 * 이 기기에서 알림을 받을지 켜고 끄는 설정.
 *
 * 웹 푸시 권한과 구독은 (사용자 x 기기 x 브라우저)마다 따로 존재하므로
 * "계정 설정"이 아니라 "이 기기 설정"으로 표현한다.
 */
function PushSettings() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)

  const supported = isPushSupported()
  const installRequired = needsIOSInstall()
  const permission = getPermission()

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      setEnabled(await hasActiveSubscription())
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleToggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (enabled) {
        await disablePush()
        setEnabled(false)
        return
      }

      const result = await enablePush()
      if (result.ok) {
        setEnabled(true)
        return
      }
      if (result.reason === 'denied') {
        setError(
          '알림이 차단되어 있습니다. 브라우저 주소창의 자물쇠 아이콘을 눌러 알림을 ‘허용’으로 바꿔주세요.',
        )
      } else if (result.reason === 'misconfigured') {
        setError('알림 서버 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.')
      } else if (result.reason === 'unsupported') {
        setError('이 브라우저는 알림을 지원하지 않습니다.')
      }
      // 'default'(팝업을 그냥 닫음)는 안내 없이 원상태 유지
    } catch (err) {
      console.error('알림 설정 변경 실패:', err)
      setError(err.message || '알림 설정 변경 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /* iOS Safari 일반 탭: 권한 요청 자체가 불가능하므로 설치 안내만 노출 */
  if (installRequired) {
    return (
      <section className="push-settings">
        <h3 className="push-settings-title">알림</h3>
        <div className="push-settings-notice">
          <p className="push-settings-notice-head">홈 화면에 추가하면 알림을 받을 수 있어요</p>
          <ol className="push-settings-steps">
            <li>화면 아래 <b>공유 버튼</b>을 누릅니다</li>
            <li><b>홈 화면에 추가</b>를 선택합니다</li>
            <li>홈 화면 <b>아이콘으로 다시 열어주세요</b></li>
          </ol>
        </div>
      </section>
    )
  }

  if (!supported) {
    return (
      <section className="push-settings">
        <h3 className="push-settings-title">알림</h3>
        <div className="push-settings-notice">
          <p>이 브라우저는 알림을 지원하지 않습니다. Chrome, Edge, Safari 최신 버전을 사용해주세요.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="push-settings">
      <h3 className="push-settings-title">알림</h3>

      {error && <div className="error-banner">{error}</div>}

      <div className="push-settings-row">
        <div className="push-settings-label">
          <span className="push-settings-name">이 기기에서 알림 받기</span>
          <span className="push-settings-sub">
            {enabled
              ? '다른 사람이 일정을 등록·변경하면 알려드립니다'
              : permission === 'denied'
                ? '브라우저에서 알림이 차단된 상태입니다'
                : '지금은 알림을 받지 않습니다'}
          </span>
        </div>

        <button
          type="button"
          className={`push-switch${enabled ? ' is-on' : ''}`}
          onClick={handleToggle}
          disabled={busy}
          role="switch"
          aria-checked={enabled}
          aria-label="이 기기에서 알림 받기"
        >
          <span className="push-switch-knob" />
        </button>
      </div>

      <p className="push-settings-foot">
        알림은 기기마다 따로 설정됩니다. 휴대폰과 PC 모두에서 받으려면 각각 켜주세요.
      </p>
    </section>
  )
}

export default PushSettings
