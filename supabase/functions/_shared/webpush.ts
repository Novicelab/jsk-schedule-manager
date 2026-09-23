/* ============================================================
 * 웹 푸시 발송 (RFC 8291 페이로드 암호화 + RFC 8292 VAPID)
 * ------------------------------------------------------------
 * Deno 표준 WebCrypto만 사용한다. 외부 의존성 없음.
 *
 * 동작 요약
 *  1) 구독의 p256dh 공개키와 임시 키쌍으로 ECDH -> 공유 비밀
 *  2) HKDF로 CEK(암호화 키) / NONCE 유도
 *  3) AES-128-GCM으로 페이로드 암호화 (aes128gcm 콘텐츠 인코딩)
 *  4) VAPID 개인키로 ES256 JWT 서명 -> Authorization 헤더
 *  5) 푸시 서비스(FCM/Mozilla/APNs) 엔드포인트로 POST
 * ============================================================ */

export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface VapidKeys {
  /** base64url, 65바이트 비압축 P-256 공개점 */
  publicKey: string
  /** base64url, 32바이트 스칼라 */
  privateKey: string
  /** mailto: 또는 https: 로 시작하는 연락처 */
  subject: string
}

export type PushResult =
  | { ok: true; status: number }
  | { ok: false; status: number; expired: boolean; error: string }

const enc = new TextEncoder()

/**
 * WebCrypto가 요구하는 BufferSource는 ArrayBuffer 기반 뷰여야 한다.
 * `new Uint8Array(n)` 는 TS 5.7+ 에서 ArrayBufferLike(SharedArrayBuffer 포함)로 추론되어
 * subtle.* 호출에 그대로 넘길 수 없으므로, 항상 ArrayBuffer를 명시해 생성한다.
 */
type Bytes = Uint8Array<ArrayBuffer>

function allocate(length: number): Bytes {
  return new Uint8Array(new ArrayBuffer(length))
}

function bytesOf(values: number[]): Bytes {
  const out = allocate(values.length)
  out.set(values)
  return out
}

/* ── base64url ─────────────────────────────────────────── */

function b64urlDecode(value: string): Bytes {
  const pad = '='.repeat((4 - (value.length % 4)) % 4)
  const b64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = allocate(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Bytes {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = allocate(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

async function hkdf(
  salt: Bytes,
  ikm: Bytes,
  info: Bytes,
  length: number,
): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/* ── 페이로드 암호화 (RFC 8291) ────────────────────────── */

async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Bytes> {
  const uaPublic = b64urlDecode(p256dh) // 65바이트
  const authSecret = b64urlDecode(auth) // 16바이트

  // 이 발송에만 쓰는 임시 키쌍 (application server)
  const asKeys = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey))

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256),
  )

  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info\0"||ua_pub||as_pub)
  const keyInfo = concat(enc.encode('WebPush: info'), bytesOf([0]), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(allocate(16))
  const cek = await hkdf(
    salt,
    ikm,
    concat(enc.encode('Content-Encoding: aes128gcm'), bytesOf([0])),
    16,
  )
  const nonce = await hkdf(
    salt,
    ikm,
    concat(enc.encode('Content-Encoding: nonce'), bytesOf([0])),
    12,
  )

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 = 마지막 레코드 구분자
  const plaintext = concat(enc.encode(payload), bytesOf([2]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      plaintext,
    ),
  )

  // 본문 = salt(16) || record_size(4) || idlen(1) || keyid(65) || ciphertext
  const recordSize = allocate(4)
  new DataView(recordSize.buffer).setUint32(0, 4096, false)

  return concat(salt, recordSize, bytesOf([asPublic.length]), asPublic, ciphertext)
}

/* ── VAPID 인증 헤더 (RFC 8292) ────────────────────────── */

async function importVapidPrivateKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const pub = b64urlDecode(publicKey) // 0x04 || x(32) || y(32)
  if (pub.length !== 65 || pub[0] !== 4) {
    throw new Error('VAPID 공개키 형식이 올바르지 않습니다 (65바이트 비압축 점이어야 함).')
  }
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: privateKey,
    ext: true,
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
}

async function createVapidAuthHeader(endpoint: string, keys: VapidKeys): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 최대 24시간 미만이어야 함
    sub: keys.subject,
  }

  const signingInput =
    b64urlEncode(enc.encode(JSON.stringify(header))) +
    '.' +
    b64urlEncode(enc.encode(JSON.stringify(claims)))

  const key = await importVapidPrivateKey(keys.publicKey, keys.privateKey)
  // ECDSA sign은 JWS ES256이 요구하는 raw r||s(64바이트)를 그대로 반환한다
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)),
  )

  return 'vapid t=' + signingInput + '.' + b64urlEncode(signature) + ', k=' + keys.publicKey
}

/* ── 발송 ──────────────────────────────────────────────── */

/**
 * 구독 1건에 웹 푸시를 발송한다.
 * 404/410 응답은 구독이 사라진 것이므로 `expired: true`로 표시한다.
 * 호출 측에서 해당 구독을 DB에서 삭제해야 한다.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  keys: VapidKeys,
  ttlSeconds = 86400,
): Promise<PushResult> {
  try {
    const body = await encryptPayload(payload, subscription.p256dh, subscription.auth)
    const authorization = await createVapidAuthHeader(subscription.endpoint, keys)

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttlSeconds),
      },
      body,
    })

    if (response.ok) {
      return { ok: true, status: response.status }
    }

    const text = await response.text().catch(() => '')
    return {
      ok: false,
      status: response.status,
      expired: response.status === 404 || response.status === 410,
      error: text.slice(0, 200) || 'HTTP ' + response.status,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
