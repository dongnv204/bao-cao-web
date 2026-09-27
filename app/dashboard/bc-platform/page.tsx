'use client'

import { useState, useEffect, useCallback } from 'react'
import { cacheGet, cacheSet } from '@/lib/cache'

// ─── Types ────────────────────────────────────────────────────────────────────
interface BCPlatformData {
  month: number
  year: number
  updatedAt: string
  empty: boolean
  message?: string
  tongQuan?: {
    tongFormNhap: number
    uvNet: number
    uvTrung: number
    tyLeTrung: string
  }
  phanLoaiTrangThai?: { label: string; soLuong: number }[]
  uvTheoNgay?: { ngay: string; soLuong: number }[]
}

type TabState = 'tong-quan' | 'phan-loai' | 'theo-ngay'

// ─── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{title}</h2>
      {children}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function BCPlatformPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [data, setData]   = useState<BCPlatformData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab]     = useState<TabState>('tong-quan')

  // ── Fetch function ──────────────────────────────────────────────────
  const fetchData = useCallback(async (m: number, y: number, force = false) => {
    const key = `bc-platform:${m}:${y}`
    if (!force) {
      const cached = cacheGet(key)
      if (cached) { setData(cached); return }
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/bc-platform?month=${m}&year=${y}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: BCPlatformData = await res.json()
      cacheSet(key, json)
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Listen for prefetch event ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ data: BCPlatformData; month: number; year: number }>
      if (evt.detail.month === month && evt.detail.year === year) {
        setData(evt.detail.data)
      }
    }
    window.addEventListener('prefetch:bc-platform', handler)
    return () => window.removeEventListener('prefetch:bc-platform', handler)
  }, [month, year])

  // ── Initial load ────────────────────────────────────────────────────
  useEffect(() => {
    fetchData(month, year)
  }, [month, year, fetchData])

  // ── Helpers ──────────────────────────────────────────────────────────
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years  = [now.getFullYear() - 1, now.getFullYear()]

  const totalPhanLoai = data?.phanLoaiTrangThai?.reduce((s, r) => s + r.soLuong, 0) ?? 0
  const maxNgay = Math.max(...(data?.uvTheoNgay?.map(r => r.soLuong) ?? [1]), 1)

  // ── Tabs config ──────────────────────────────────────────────────────
  const tabs: { key: TabState; label: string }[] = [
    { key: 'tong-quan', label: 'Tổng Quan' },
    { key: 'phan-loai', label: 'Phân Loại' },
    { key: 'theo-ngay', label: 'Theo Ngày' },
  ]

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BC Platform</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data?.updatedAt ? `Cập nhật: ${data.updatedAt}` : 'Báo cáo tuyển dụng nền tảng'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Month selector */}
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm"
          >
            {months.map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          {/* Year selector */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Refresh */}
          <button
            onClick={() => fetchData(month, year, true)}
            disabled={loading}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? '⟳ Đang tải...' : '↻ Làm mới'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 mb-4 text-red-700 dark:text-red-300 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Empty state */}
      {data?.empty && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 mb-4 text-yellow-700 dark:text-yellow-300 text-sm">
          Chưa có dữ liệu cho tháng {month}/{year}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      )}

      {/* Content */}
      {data && !data.empty && (
        <>
          {/* KPI strip */}
          {data.tongQuan && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Tổng Form Nhập"  value={data.tongQuan.tongFormNhap.toLocaleString()} />
              <KpiCard label="UV Net"           value={data.tongQuan.uvNet.toLocaleString()} />
              <KpiCard label="UV Trúng"         value={data.tongQuan.uvTrung.toLocaleString()} />
              <KpiCard label="Tỷ Lệ Trúng"     value={data.tongQuan.tyLeTrung} />
            </div>
          )}

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab: Tổng Quan */}
          {tab === 'tong-quan' && data.tongQuan && (
            <Section title="Chỉ số tổng quan">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Thống kê</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        { label: 'Tổng Form Nhập', value: data.tongQuan.tongFormNhap.toLocaleString() },
                        { label: 'UV Net', value: data.tongQuan.uvNet.toLocaleString() },
                        { label: 'UV Trúng', value: data.tongQuan.uvTrung.toLocaleString() },
                        { label: 'Tỷ Lệ Trúng', value: data.tongQuan.tyLeTrung },
                      ].map(row => (
                        <tr key={row.label} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <td className="py-2 text-gray-500 dark:text-gray-400">{row.label}</td>
                          <td className="py-2 font-semibold text-right text-gray-900 dark:text-white">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}

          {/* Tab: Phân Loại Trạng Thái */}
          {tab === 'phan-loai' && data.phanLoaiTrangThai && (
            <Section title="Phân loại trạng thái">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 dark:text-gray-300">Trạng Thái</th>
                      <th className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-gray-300">Số Lượng</th>
                      <th className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-gray-300">Tỷ Lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.phanLoaiTrangThai.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300">{row.label}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-white">{row.soLuong.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400">
                          {totalPhanLoai > 0 ? ((row.soLuong / totalPhanLoai) * 100).toFixed(1) + '%' : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                      <td className="py-2.5 px-4 font-semibold text-gray-700 dark:text-gray-300">Tổng</td>
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900 dark:text-white">{totalPhanLoai.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-gray-700 dark:text-gray-300">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          )}

          {/* Tab: UV Theo Ngày */}
          {tab === 'theo-ngay' && data.uvTheoNgay && (
            <Section title="UV theo ngày">
              {/* Mini bar chart */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm mb-4">
                <div className="flex items-end gap-1 h-32">
                  {data.uvTheoNgay.map((row, i) => {
                    const pct = Math.round((row.soLuong / maxNgay) * 100)
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 gap-0.5" title={`${row.ngay}: ${row.soLuong}`}>
                        <div
                          className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-all"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                        {data.uvTheoNgay && data.uvTheoNgay.length <= 15 && (
                          <span className="text-[9px] text-gray-400 rotate-90 origin-center">{row.ngay.slice(-2)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Table */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 dark:text-gray-300">Ngày</th>
                      <th className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-gray-300">Số UV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.uvTheoNgay.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{row.ngay}</td>
                        <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">{row.soLuong.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
