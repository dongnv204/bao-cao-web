import { createClient } from '@supabase/supabase-js'

// Bắt lỗi rõ ràng khi thiếu env vars — tránh silent fail với placeholder
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Kiểu dữ liệu User
export interface User {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'manager' | 'viewer'
  active: boolean
  created_at: string
}
