'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại')
        return
      }

      // Đăng nhập thành công → vào dashboard
      router.push('/dashboard')
    } catch {
      setError('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-300 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-200 rounded-full opacity-40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo / Tên công ty */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hệ Thống Báo Cáo</h1>
          <p className="text-slate-500 text-sm mt-1">Dành cho nội bộ công ty</p>
        </div>

        {/* Form đăng nhập */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/60">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Thông báo lỗi */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Tên đăng nhập */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                required
                autoComplete="username"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400
                           rounded-xl px-4 py-3 text-sm outline-none
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition"
              />
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400
                           rounded-xl px-4 py-3 text-sm outline-none
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition"
              />
            </div>

            {/* Nút đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300
                         text-white font-semibold py-3 px-4 rounded-xl text-sm
                         transition shadow-lg shadow-blue-600/20
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang xử lý...
                </>
              ) : 'Đăng nhập'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Chỉ dành cho nhân viên nội bộ
        </p>
      </div>
    </div>
  )
}
