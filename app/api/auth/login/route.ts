import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSession, COOKIE_NAME } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = String(body.username ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      return NextResponse.json({ error: 'Lỗi cấu hình server' }, { status: 500 })
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false }
    })

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, password_hash, active')
      .eq('username', username)
      .eq('active', true)
      .maybeSingle()

    if (error) {
      console.error('DB error:', error.message)
      return NextResponse.json({ error: 'Lỗi DB: ' + error.message }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 })
    }

    const token = await createSession({
      id: user.id, username: user.username,
      full_name: user.full_name, role: user.role,
    })

    const res = NextResponse.json({ success: true, user: {
      id: user.id, username: user.username,
      full_name: user.full_name, role: user.role
    }})

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true, secure: true,
      sameSite: 'lax', maxAge: 60 * 60 * 8, path: '/',
    })

    return res
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
  }
}