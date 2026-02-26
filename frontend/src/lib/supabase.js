import { createClient } from '@supabase/supabase-js'

// Render 빌드 시 환경변수에 개행문자가 삽입될 수 있어 \s 전체 제거
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/\s/g, '')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
