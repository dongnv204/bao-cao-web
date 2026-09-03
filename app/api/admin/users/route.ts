import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
)
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  // Chỉ admin mới được tạo user
  const session = await verifySession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
  }

  try {
    const { username, full_name, password, role } = await request.json()

    // Validate
    if (!username || !full_name || !password || !role) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, { status: 400 })
    }
    if (!['admin', 'manager', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Role không hợp lệ' }, { status: 400 })
    }

    // Mã hoá mật khẩu bằng bcrypt (salt rounds = 12)
    const password_hash = await bcrypt.hash(password, 12)

    // Lưu vào Supabase
    const { error } = await supabase.from('users').insert({
      username: username.trim().toLowerCase(),
      full_name: full_name.trim(),
      password_hash,
      role,
      active: true,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
  }
}
