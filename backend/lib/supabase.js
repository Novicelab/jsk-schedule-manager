'use strict'

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
}

// Service Role Key를 사용하는 Admin Client (RLS 우회)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

module.exports = { supabaseAdmin }
