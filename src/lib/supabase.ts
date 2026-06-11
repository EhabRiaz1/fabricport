import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key?.trim()) return true
  return (
    key.includes('your_anon_key_here') ||
    key.includes('your_service_role_key_here')
  )
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and add your Supabase anon key.',
  )
}

if (isPlaceholderKey(supabaseAnonKey)) {
  throw new Error(
    'Invalid VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and paste the publishable or anon key from Supabase → Project Settings → API.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
