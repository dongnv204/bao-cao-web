'use client'

import { useState, useEffect, useCallback } from 'react'

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
  admin:   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  manager: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  viewer:  'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', viewer: 'Viewer',
}

// Toast nhỏ góc trên
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  const isOk = msg.startsWith('✅')
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm shadow-lg
      ${isOk
        ? 'bg-emerald-600 text-white'
        : 'bg-red-600 text-white'}`}>
      {msg}
    </div>
  )
}

// Modal đổi mật khẩu
function ResetPasswordModal({ user, onClose, onSuccess }: {
  user: User; onClose: () => void; onSuccess: (msg: string) => void
}) {
  const [pw, setPw]     = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, password: pw }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { onSuccess('❌ ' + (data.error || 'Lỗi')); return }
    onSuccess('✅ Đổi mật khẩu thành công')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Đổi mật khẩu</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Tài khoản: <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{user.username}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
            required
            minLength={8}
            autoFocus
            className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600
                       text-slate-900 dark:text-white text-sm rounded-xl px-3 py-2.5 outline-none
                       focus:border-blue-500 dark:focus:border-blue-400 transition"
          />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              Huỷ
            </button>
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                         px-5 py-2 rounded-xl transition disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal xác nhận xóa
function DeleteConfirmModal({ user, onClose, onConfirm, deleting }: {
  user: User; onClose: () => void; onConfirm: () => void; deleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Xác nhận xóa tài khoản</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Bạn có chắc muốn xóa tài khoản{' '}
          <span className="font-mono font-semibold text-red-600 dark:text-red-400">{user.username}</span>?
          <br />Hành động này không thể hoàn tác.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
            Huỷ
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium
                       px-5 py-2 rounded-xl transition disabled:opacity-50">
            {deleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')

  // Modal states
  const [resetUser,  setResetUser]  = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleting,   setDeleting]   = useState(false)

  // Inline edit state
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editData, setEditData] = useState({ full_name: '', role: '' })

  // Form tạo user mới
  const [form, setForm] = useState({
    username: '', full_name: '', password: '', role: 'viewer',
  })

  // Load danh sách qua API (server dùng service role key)
  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Tạo user mới
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setToast('❌ ' + (data.error || 'Lỗi tạo user')); return }
    setToast('✅ Tạo tài khoản thành công!')
    setForm({ username: '', full_name: '', password: '', role: 'viewer' })
    setShowForm(false)
    loadUsers()
  }

  // Bật/tắt active
  async function toggleActive(u: User) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    })
    if (!res.ok) { setToast('❌ Lỗi cập nhật trạng thái'); return }
    setToast(u.active ? '✅ Đã khóa tài khoản' : '✅ Đã mở khóa tài khoản')
    loadUsers()
  }

  // Lưu inline edit
  async function saveEdit(id: string) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, full_name: editData.full_name, role: editData.role }),
    })
    const data = await res.json()
    if (!res.ok) { setToast('❌ ' + (data.error || 'Lỗi lưu')); return }
    setToast('✅ Đã cập nhật thông tin')
    setEditId(null)
    loadUsers()
  }

  // Xóa user
  async function handleDelete() {
    if (!deleteUser) return
    setDeleting(true)
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteUser.id }),
    })
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) { setToast('❌ ' + (data.error || 'Lỗi xóa')); setDeleteUser(null); return }
    setToast('✅ Đã xóa tài khoản')
    setDeleteUser(null)
    loadUsers()
  }

  return (
    <>
      {/* Toast */}
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* Modals */}
      {resetUser  && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSuccess={setToast}
        />
      )}
      {deleteUser && (
        <DeleteConfirmModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      <div className="space-y-5">
        {/* Nút tạo mới */}
        <div className="flex justify-end">
          <button
            onClick={() => { setShowForm(!showForm); setForm({ username: '', full_name: '', password: '', role: 'viewer' }) }}
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
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
            <h3 className="text-slate-900 dark:text-white font-semibold mb-5">Tạo tài khoản mới</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Tên đăng nhập
                </label>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                  placeholder="vd: nhansu01"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600
                             text-slate-900 dark:text-white placeholder-slate-400 text-sm
                             rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-600 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Họ và tên
                </label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="vd: Nguyễn Văn A"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600
                             text-slate-900 dark:text-white placeholder-slate-400 text-sm
                             rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-600 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  minLength={8}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600
                             text-slate-900 dark:text-white placeholder-slate-400 text-sm
                             rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-600 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Quyền
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600
                             text-slate-900 dark:text-white text-sm
                             rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
                  Huỷ
                </button>
                <button type="submit" disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                             px-5 py-2 rounded-xl transition disabled:opacity-50">
                  {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Danh sách users */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Đang tải...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Tên đăng nhập
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Họ tên
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Quyền
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Trạng thái
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}
                      className="border-b border-slate-100 dark:border-slate-700/60
                                 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">

                      {/* Username */}
                      <td className="py-3 px-4 font-mono text-sm text-slate-900 dark:text-slate-100">
                        {u.username}
                      </td>

                      {/* Họ tên — inline edit */}
                      <td className="py-3 px-4">
                        {editId === u.id ? (
                          <input
                            value={editData.full_name}
                            onChange={e => setEditData(d => ({ ...d, full_name: e.target.value }))}
                            className="bg-white dark:bg-slate-700 border border-blue-400 text-slate-900 dark:text-white
                                       text-sm rounded-lg px-2 py-1 outline-none w-full max-w-[180px]"
                            autoFocus
                          />
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">{u.full_name}</span>
                        )}
                      </td>

                      {/* Quyền — inline edit */}
                      <td className="py-3 px-4">
                        {editId === u.id ? (
                          <select
                            value={editData.role}
                            onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                            className="bg-white dark:bg-slate-700 border border-blue-400 text-slate-900 dark:text-white
                                       text-xs rounded-lg px-2 py-1 outline-none"
                          >
                            {ROLE_OPTIONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${ROLE_BADGE[u.role]}`}>
                            {ROLE_LABEL[u.role]}
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-4">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium
                          ${u.active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {u.active ? '● Hoạt động' : '○ Bị khóa'}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          {editId === u.id ? (
                            <>
                              <button onClick={() => saveEdit(u.id)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition font-medium">
                                Lưu
                              </button>
                              <button onClick={() => setEditId(null)}
                                className="text-xs px-3 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                                Huỷ
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Sửa */}
                              <button
                                onClick={() => { setEditId(u.id); setEditData({ full_name: u.full_name, role: u.role }) }}
                                title="Sửa thông tin"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                              </button>

                              {/* Đổi mật khẩu */}
                              <button
                                onClick={() => setResetUser(u)}
                                title="Đổi mật khẩu"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                </svg>
                              </button>

                              {/* Khóa / Mở khóa */}
                              <button
                                onClick={() => toggleActive(u)}
                                title={u.active ? 'Khóa tài khoản' : 'Mở khóa'}
                                className={`p-1.5 rounded-lg transition
                                  ${u.active
                                    ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}>
                                {u.active ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M8 11V7a4 4 0 018 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                                  </svg>
                                )}
                              </button>

                              {/* Xóa */}
                              <button
                                onClick={() => setDeleteUser(u)}
                                title="Xóa tài khoản"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                        Chưa có người dùng nào. Tạo tài khoản đầu tiên!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer tổng số */}
          {!loading && users.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700
                            text-xs text-slate-400 dark:text-slate-500">
              {users.length} tài khoản •{' '}
              {users.filter(u => u.active).length} đang hoạt động •{' '}
              {users.filter(u => !u.active).length} bị khóa
            </div>
          )}
        </div>
      </div>
    </>
  )
}
