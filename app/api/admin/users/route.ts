import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// Supabase với service role key để bypass RLS
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

// Helper: chỉ cho admin vào
async function requireAdmin() {
  const session = await verifySession()
  if (!session || session.role !== 'admin') return null
  return session
}

// GET: Lấy danh sách tất cả users
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, role, active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: Tạo user mới
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
  }

  const body = await request.json()
  const { username, full_name, password, role } = body

  // Validate
  if (!username || !full_name || !password || !role) {
    return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, { status: 400 })
  }
  if (!['admin', 'manager', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Quyền không hợp lệ' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Kiểm tra username đã tồn tại
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const { error } = await supabase.from('users').insert({
    username:      username.trim().toLowerCase(),
    full_name:     full_name.trim(),
    password_hash,
    role,
    active: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH: Cập nhật user (họ tên, quyền, trạng thái, đổi mật khẩu)
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
  }

  const body = await request.json()
  const { id, password, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Thiếu id người dùng' }, { status: 400 })

  // Nếu đổi mật khẩu → hash trước
  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, { status: 400 })
    }
    updates.password_hash = await bcrypt.hash(password, 12)
  }

  const supabase = getSupabase()
  const { error } = await supabase.from('users').update(updates).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: Xóa user
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
  }

  const body = await request.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'Thiếu id người dùng' }, { status: 400 })

  // Không cho xóa tài khoản đang đăng nhập
  if (id === admin.id) {
    return NextResponse.json({ error: 'Không thể xóa tài khoản đang đăng nhập' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase.from('users').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
