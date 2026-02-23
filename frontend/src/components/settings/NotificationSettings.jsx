import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PREFERENCE_ORDER = [
  'VACATION_CREATED',
  'VACATION_UPDATED',
  'VACATION_DELETED',
  'WORK_CREATED',
  'WORK_UPDATED',
  'WORK_DELETED',
]

const FALLBACK_LABELS = {
  VACATION_CREATED: '휴가 등록 시',
  VACATION_UPDATED: '휴가 수정 시',
  VACATION_DELETED: '휴가 삭제 시',
  WORK_CREATED: '업무 등록 시',
  WORK_UPDATED: '업무 수정 시',
  WORK_DELETED: '업무 삭제 시',
}

function NotificationSettings() {
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingKey, setUpdatingKey] = useState(null)
  const [feedbackKey, setFeedbackKey] = useState(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    setLoading(true)
    setError(null)
    try {
      // 현재 사용자 ID 조회
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single()

      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', currentUser.id)

      if (fetchError) throw fetchError

      // key 형식으로 변환: schedule_type + '_' + action_type
      const mapped = (data || []).map(p => ({
        id: p.id,
        key: `${p.schedule_type}_${p.action_type}`,
        label: FALLBACK_LABELS[`${p.schedule_type}_${p.action_type}`] || `${p.schedule_type} ${p.action_type}`,
        enabled: p.enabled,
        scheduleType: p.schedule_type,
        actionType: p.action_type,
      }))

      // 고정된 순서로 정렬
      const sorted = PREFERENCE_ORDER.map((key) => {
        const found = mapped.find((p) => p.key === key)
        return found || { key, label: FALLBACK_LABELS[key], enabled: true }
      })
      setPreferences(sorted)
    } catch (err) {
      console.error('알림 설정 조회 실패:', err)
      setError('알림 설정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (key, currentEnabled) => {
    setUpdatingKey(key)
    try {
      const [scheduleType, actionType] = key.split('_')

      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single()

      const { error: updateError } = await supabase
        .from('notification_preferences')
        .update({ enabled: !currentEnabled })
        .eq('user_id', currentUser.id)
        .eq('schedule_type', scheduleType)
        .eq('action_type', actionType)

      if (updateError) throw updateError

      setPreferences((prev) =>
        prev.map((p) => (p.key === key ? { ...p, enabled: !currentEnabled } : p))
      )
      setFeedbackKey(key)
      setTimeout(() => setFeedbackKey(null), 1500)
    } catch (err) {
      console.error('알림 설정 업데이트 실패:', err)
      setError('알림 설정 변경에 실패했습니다. 다시 시도해 주세요.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setUpdatingKey(null)
    }
  }

  const vacationPrefs = preferences.filter((p) => p.key.startsWith('VACATION'))
  const workPrefs = preferences.filter((p) => p.key.startsWith('WORK'))

  if (loading) {
    return (
      <div className="notification-settings-loading">
        알림 설정을 불러오는 중...
      </div>
    )
  }

  return (
    <div className="notification-settings">
      <h3 className="notification-settings-title">알림 수신 여부</h3>

      {error && (
        <div className="notification-settings-error">{error}</div>
      )}

      <div className="notification-settings-grid">
        {/* 휴가 섹션 */}
        <div className="notification-section">
          <h4 className="notification-section-title">휴가</h4>
          <div className="notification-items">
            {vacationPrefs.map((pref) => (
              <ToggleRow
                key={pref.key}
                pref={pref}
                isUpdating={updatingKey === pref.key}
                showFeedback={feedbackKey === pref.key}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>

        {/* 업무 섹션 */}
        <div className="notification-section">
          <h4 className="notification-section-title">업무</h4>
          <div className="notification-items">
            {workPrefs.map((pref) => (
              <ToggleRow
                key={pref.key}
                pref={pref}
                isUpdating={updatingKey === pref.key}
                showFeedback={feedbackKey === pref.key}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ pref, isUpdating, showFeedback, onToggle }) {
  const actionLabel = pref.label.replace('휴가 ', '').replace('업무 ', '')

  return (
    <div className="toggle-row">
      <span className="toggle-label">{actionLabel}</span>
      <div className="toggle-right">
        {showFeedback && (
          <span className="toggle-feedback">
            {pref.enabled ? '켜짐' : '꺼짐'}
          </span>
        )}
        <button
          className={`toggle-btn ${pref.enabled ? 'toggle-btn-on' : 'toggle-btn-off'}`}
          onClick={() => onToggle(pref.key, pref.enabled)}
          disabled={isUpdating}
          aria-pressed={pref.enabled}
          aria-label={`${pref.label} 알림 ${pref.enabled ? '끄기' : '켜기'}`}
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  )
}

export default NotificationSettings
