'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'manager' | 'viewer'
  active: boolean
  created_at: string
}

const ROLE_OPTIONS = [
  { value: 'admin',   label: 'Admin — Toàn quyền' },
  { value: 'manager', label: 'Manager — Xem hầu hết BC' },
  { value: 'viewer',  label: 'Viewer — Chỉ xem BC được giao' },
]

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-50 text-red-600 border-red-200',
  manager: 'bg-amber-50 text-amber-700 border-amber-200',
  viewer:  'bg-slate-100 text-slate-600 border-slate-200',
}

export default function UserManagement() {
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')

  // Form tạo user mới
  const [form, setForm] = useState({
    username: '', full_name: '', password: '', role: 'viewer' as const,
  })

  // Load danh sách users
  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, username, full_name, role, active, created_at')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  // Tạo user mới
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setMsg('❌ ' + (data.error || 'Lỗi tạo user'))
      } else {
        setMsg('✅ Tạo tài khoản thành công!')
        setForm({ username: '', full_name: '', password: '', role: 'viewer' })
        setShowForm(false)
        loadUsers()
      }
    } catch {
      setMsg('❌ Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  // Bật/tắt active
  async function toggleActive(id: string, active: boolean) {
    await supabase.from('users').update({ active: !active }).eq('id', id)
    loadUsers()
  }

  return (
    <div className="space-y-5">
      {/* Thông báo */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm
          ${msg.startsWith('✅') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                 : 'bg-red-50 border border-red-200 text-red-600'}`}>
          {msg}
        </div>
      )}

      {/* Nút tạo mới */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                     px-4 py-2.5 rounded-xl transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tạo tài khoản mới
        </button>
      </div>

      {/* Form tạo user */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-slate-900 font-semibold mb-5">Tạo tài khoản mới</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">Tên đăng nhập</label>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                placeholder="vd: nhansu01"
                required
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm
                           rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">Họ và tên</label>
              <input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="vd: Nguyễn Văn A"
                required
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm
                           rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">Mật khẩu</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Tối thiểu 8 ký tự"
                required
                minLength={8}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm
                           rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">Quyền</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as typeof form.role }))}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm
                           rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-500 hover:text-slate-900 text-sm transition"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                           px-5 py-2 rounded-xl transition disabled:opacity-50"
              >
                {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách users */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Đang tải...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Tên đăng nhập</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Họ tên</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Quyền</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Trạng thái</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-900">{u.username}</td>
                  <td className="py-3 px-4 text-slate-600">{u.full_name}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${ROLE_BADGE[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded
                      ${u.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'}`}>
                      {u.active ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleActive(u.id, u.active)}
                      className={`text-xs px-3 py-1 rounded-lg transition
                        ${u.active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-emerald-700 hover:bg-emerald-50'}`}
                    >
                      {u.active ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                    Chưa có người dùng nào. Tạo tài khoản đầu tiên!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
