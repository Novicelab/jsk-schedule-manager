import { supabase } from './supabase'

/**
 * VAPID 공개키.
 *
 * 환경변수가 있으면 그 값을, 없으면 아래 기본값을 쓴다.
 * 기본값을 두는 이유:
 *  - 이 값은 원래 브라우저에 전달되는 공개 값이라 노출돼도 무방하다.
 *    (발송 권한은 Supabase Secrets의 VAPID_PRIVATE_KEY 가 가진다)
 *  - public/sw.js 도 같은 이유로 이미 이 키를 상수로 갖고 있다.
 *    (public/ 은 Vite 환경변수 치환 대상이 아님)
 *  - 배포처(Render)가 render.yaml 을 읽지 않고 대시보드 설정만 사용하므로,
 *    환경변수에만 의존하면 대시보드에 키를 넣기 전까지 알림이 동작하지 않는다.
 *
 * 키 교체 시 이 값과 public/sw.js 의 VAPID_PUBLIC_KEY 를 함께 수정할 것.
 */
const VAPID_PUBLIC_KEY_FALLBACK =
  'BI2aB7WJtRI2yWSx9FbP4shaHynkx2K1NPloRF9bUXOBbw7JD1PceeBF_zlTx6eEIFOTU7hAX53wYaAtHviHOfY'

const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim() || VAPID_PUBLIC_KEY_FALLBACK

const SNOOZE_KEY = 'push_prompt_snoozed_until'
const SNOOZE_DAYS = 7

/* ============================================================
 * 환경 판별
 * ============================================================ */

/** 이 브라우저가 웹 푸시를 지원하는가 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  // iPadOS 13+ 는 UA에 'Mac'으로 보고되므로 터치 지원 여부로 구분한다
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** 홈 화면에서 실행된 PWA 상태인가 (iOS 푸시의 전제 조건) */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

/**
 * iOS인데 아직 홈 화면에 추가하지 않은 상태인가.
 * 이 경우 권한 요청 자체가 불가능하므로 설치 안내를 먼저 보여줘야 한다.
 */
export function needsIOSInstall() {
  return isIOS() && !isStandalone()
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function getPermission() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/* ============================================================
 * 스누즈 (바텀시트 "나중에")
 * ============================================================ */

export function snoozePrompt() {
  const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000
  try {
    localStorage.setItem(SNOOZE_KEY, String(until))
  } catch {
    // 시크릿 모드 등 저장 실패 시 무시 (다음 진입에 다시 노출될 뿐)
  }
}

export function isPromptSnoozed() {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0)
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

export function clearSnooze() {
  try {
    localStorage.removeItem(SNOOZE_KEY)
  } catch {
    // 무시
  }
}

/* ============================================================
 * 내부 헬퍼
 * ============================================================ */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/** 설정 화면에서 기기를 구분해 보여주기 위한 짧은 라벨 */
function describeDevice() {
  const ua = navigator.userAgent
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac/.test(ua)
          ? 'macOS'
          : '기타'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : '브라우저'
  return os + ' ' + browser
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

async function extractError(invokeError) {
  if (invokeError?.context && typeof invokeError.context.json === 'function') {
    try {
      const body = await invokeError.context.json()
      return body?.error || body?.message || invokeError.message
    } catch {
      // body 파싱 실패 시 원본 메시지 사용
    }
  }
  return invokeError?.message || '알림 설정 중 오류가 발생했습니다.'
}

/** 구독 정보를 Edge Function으로 저장 (service_role로 RLS 우회) */
async function persistSubscription(subscription) {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.access_token) {
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
  }

  const json = subscription.toJSON()
  const { data, error } = await supabase.functions.invoke('save-push-subscription', {
    body: {
      action: 'save',
      subscription: {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      userAgent: describeDevice(),
    },
    headers: { Authorization: 'Bearer ' + sessionData.session.access_token },
  })

  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data
}

/* ============================================================
 * 공개 API
 * ============================================================ */

/**
 * 알림 켜기 — 반드시 사용자 클릭 핸들러 안에서 호출해야 한다.
 * iOS Safari는 사용자 제스처 없는 권한 요청을 무시한다.
 *
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function enablePush() {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported' }
  }
  if (!VAPID_PUBLIC_KEY) {
    console.error('VITE_VAPID_PUBLIC_KEY 가 설정되지 않았습니다.')
    return { ok: false, reason: 'misconfigured' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: permission } // 'denied' | 'default'
  }

  const registration = await registerServiceWorker()
  await navigator.serviceWorker.ready

  // 이미 구독이 있으면 재사용, 없으면 신규 발급
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  await persistSubscription(subscription)
  clearSnooze()
  return { ok: true }
}

/** 알림 끄기 — 브라우저 구독 해제 + 서버 구독 삭제 */
export async function disablePush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return { ok: true }

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.access_token) {
    await supabase.functions.invoke('save-push-subscription', {
      body: { action: 'delete', subscription: { endpoint } },
      headers: { Authorization: 'Bearer ' + sessionData.session.access_token },
    })
  }
  return { ok: true }
}

/**
 * 이미 권한이 허용된 기기에서 구독이 서버에 남아 있는지 조용히 확인/복구한다.
 * - 브라우저가 구독을 회전시킨 경우
 * - 사이트 데이터를 지운 경우
 * - 다른 기기에서 처음 접속한 경우
 * 위 상황에서 알림이 조용히 끊기는 것을 막는다. 실패해도 화면에 노출하지 않는다.
 */
export async function syncSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  if (!VAPID_PUBLIC_KEY) return

  try {
    const registration = await registerServiceWorker()
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    await persistSubscription(subscription)
  } catch (err) {
    console.warn('푸시 구독 동기화 실패(무시됨):', err)
  }
}

/** 현재 기기가 알림을 받을 수 있는 상태인지 */
export async function hasActiveSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    return Boolean(subscription)
  } catch {
    return false
  }
}
