/* ============================================================
 * JSK 일정 관리 - Service Worker (웹 푸시 수신 전용)
 * ------------------------------------------------------------
 * 이 파일은 public/ 에 있어 Vite 변환을 거치지 않고 그대로 배포된다.
 * 따라서 환경변수를 쓸 수 없어 VAPID 공개키를 상수로 둔다.
 * (VAPID 공개키는 원래 브라우저에 전달되는 공개 값이라 노출돼도 무방하다.
 *  발송 권한은 Supabase Secrets에만 있는 개인키가 가진다.)
 *
 * 키를 교체할 경우 아래 상수와 VITE_VAPID_PUBLIC_KEY 를 함께 수정할 것.
 * ============================================================ */

const VAPID_PUBLIC_KEY =
  'BI2aB7WJtRI2yWSx9FbP4shaHynkx2K1NPloRF9bUXOBbw7JD1PceeBF_zlTx6eEIFOTU7hAX53wYaAtHviHOfY'

const DEFAULT_TITLE = '간호부 일정 관리'
const ICON = '/icon-192.png'
const BADGE = '/badge-96.png'

/* 설치 즉시 활성화 (새 버전 배포 시 탭을 다시 열지 않아도 반영) */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/* ── 푸시 수신 ─────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // 암호화 페이로드가 JSON이 아닌 경우: 본문을 그대로 사용
    payload = { title: DEFAULT_TITLE, body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || DEFAULT_TITLE
  const options = {
    body: payload.body || '',
    icon: ICON,
    badge: BADGE,
    // 같은 일정에 대한 알림은 서로 덮어쓰되, 덮어쓸 때도 다시 알린다
    tag: payload.tag || 'jsk-schedule',
    renotify: true,
    timestamp: Date.now(),
    data: { url: payload.url || '/' },
    vibrate: [90, 50, 90],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

/* ── 알림 클릭 → 앱 열기 ───────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열려 있는 앱 탭이 있으면 그 탭을 재사용한다
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin)) {
            return client.focus().then((focused) => {
              if (focused && 'navigate' in focused) {
                return focused.navigate(target).catch(() => focused)
              }
              return focused
            })
          }
        }
        return self.clients.openWindow(target)
      })
  )
})

/* ── 구독 자동 만료 시 재구독 ───────────────────────────
 * 브라우저가 구독을 회전시키면 발생한다. 여기서 재구독해두지 않으면
 * 사용자가 앱을 다시 열 때까지 알림이 끊긴다.
 * 새 구독은 앱 기동 시 syncSubscription()이 서버에 반영한다.
 * ------------------------------------------------------ */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      .catch((err) => {
        console.error('[sw] 재구독 실패:', err)
      })
  )
})

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = self.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
