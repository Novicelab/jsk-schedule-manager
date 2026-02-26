import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const debugFetch = (url, options) => {
  try {
    const headers = options?.headers || {}
    const headerEntries = headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : headers
    console.log('[Supabase fetch] URL:', String(url))
    console.log('[Supabase fetch] Headers:', JSON.stringify(headerEntries))
  } catch (e) {
    console.log('[Supabase fetch] 헤더 로깅 실패:', e.message)
  }
  return fetch(url, options)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: debugFetch },
})
