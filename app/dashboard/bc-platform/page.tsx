'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTabsStore } from '../tabs-store'
import { cacheGet, cacheGetStale, cacheSet, cacheClear, cacheRemainingSeconds } from '@/lib/cache'
import { useToast } from '@/components/Toast'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

// ── Types ──────────────────────────────────────────────────────────────
interface TongQuan {
  tongFormNhap: number
  uvNet: number
  uvTrung: number
  tyLeTrung: string
}

interface PhanLoaiRow  { label: string; soLuong: number }
interface UVTheoNgayRow { ngay: string; soLuong: number }

interface BCPlatformData {
  month: number
  year: number
  updatedAt: string
  empty: boolean
  message?: string
  tongQuan?: TongQuan
  phanLoaiTrangThai?: PhanLoaiRow[]
  uvTheoNgay?: UVTheoNgayRow[]
}

// ── Multi-tab state ────────────────────────────────────────────────────
interface TabState {
  id: string
  month: number
  year: number
  data: BCPlatformData | null
  loading: boolean
  error: string
  refreshing: boolean
}

// ── Sub-components ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function BCPlatformPage() {
  const now     = new Date()
  const nextId  = useRef(2)
  const { getPage, savePage } = useTabsStore()
  const { toast, dismiss }   = useToast()

  const [tabs, setTabs] = useState<TabState[]>(() => {
    const s = getPage('bc-platform')
    if (s && s.tabs.length > 0) return s.tabs as TabState[]
    return [{
      id: '1',
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      data: null,
      loading: false,
      error: '',
      refreshing: false,
    }]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const s = getPage('bc-platform')
    return s ? s.activeTabId : '1'
  })

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  // Persist tabs to store
  useEffect(() => {
    savePage('bc-platform', { tabs, activeTabId })
  }, [tabs, activeTabId, savePage])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]

  // ── Fetch data ─────────────────────────────────────────────────────
  const fetchData = useCallback(async (
    id: string, month: number, year: number, opts?: { force?: boolean; background?: boolean }
  ) => {
    const key = `bc-platform:${month}:${year}`

    if (!opts?.force) {
      const cached = cacheGet<BCPlatformData>(key)
      if (cached) { updateTab(id, { data: cached, loading: false }); return }
    }

    if (!opts?.background) updateTab(id, { loading: true, error: '' })

    try {
      const res = await fetch(`/api/reports/bc-platform?month=${month}&year=${year}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d: BCPlatformData = await res.json()
      cacheSet(key, d)
      updateTab(id, { data: d, loading: false, refreshing: false })
    } catch (e: any) {
      const stale = cacheGetStale<BCPlatformData>(key)
      if (stale) {
        updateTab(id, { data: stale, loading: false, refreshing: false })
        toast('Dùng dữ liệu cũ do lỗi mạng', 'warning')
      } else {
        updateTab(id, { error: e.message, loading: false, refreshing: false })
      }
    }
  }, [updateTab, toast])

  // ── Listen for prefetch event ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ data: BCPlatformData; month: number; year: number }>
      const { data, month, year } = ev.detail
      const key = `bc-platform:${month}:${year}`
      cacheSet(key, data)
      tabs.forEach(t => {
        if (t.month === month && t.year === year && !t.data) {
          updateTab(t.id, { data, loading: false })
        }
      })
    }
    window.addEventListener('prefetch:bc-platform', handler)
    return () => window.removeEventListener('prefetch:bc-platform', handler)
  }, [tabs, updateTab])

  // Initial load for each tab
  useEffect(() => {
    tabs.forEach(t => {
      if (!t.data && !t.loading) fetchData(t.id, t.month, t.year)
    })
  }, []) // eslint-disable-line

  // Realtime refresh
  useRealtimeRefresh(() => {
    if (activeTab) fetchData(activeTab.id, activeTab.month, activeTab.year, { force: true, background: true })
  })

  // ── Tab management ─────────────────────────────────────────────────
  const addTab = () => {
    const id = String(nextId.current++)
    const newTab: TabState = {
      id, month: now.getMonth() + 1, year: now.getFullYear(),
      data: null, loading: false, error: '', refreshing: false,
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    fetchData(id, newTab.month, newTab.year)
  }

  const closeTab = (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id) setActiveTabId(next[next.length - 1]?.id ?? '1')
      return next
    })
  }

  const changeMonth = (id: string, month: number, year: number) => {
    updateTab(id, { month, year, data: null, loading: true, error: '' })
    fetchData(id, month, year)
  }

  const refresh = (id: string) => {
    if (!activeTab) return
    cacheClear(`bc-platform:${activeTab.month}:${activeTab.year}`)
    updateTab(id, { refreshing: true })
    fetchData(id, activeTab.month, activeTab.year, { force: true })
    const tid = toast('Đang làm mới...', 'info')
    setTimeout(() => dismiss(tid), 2000)
  }

  // ── Months dropdown ────────────────────────────────────────────────
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearOptions  = [now.getFullYear() - 1, now.getFullYear()]

  // ── Render ─────────────────────────────────────────────────────────
  const d = activeTab?.data

  const remaining = activeTab
    ? cacheRemainingSeconds(`bc-platform:${activeTab.month}:${activeTab.year}`)
    : 0

  return (
    <div className="flex flex-col h-full">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-3 pt-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-x-auto">
        {tabs.map(t => (
          <div
            key={t.id}
            onClick={() => setActiveTabId(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-t text-sm cursor-pointer whitespace-nowrap border-b-2 transition-colors ${
              t.id === activeTabId
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>{t.month}/{t.year}</span>
            {t.loading && <span className="animate-spin text-xs">⟳</span>}
            {tabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); closeTab(t.id) }}
                className="ml-1 text-gray-400 hover:text-red-500 text-xs leading-none"
              >×</button>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          className="ml-1 px-2 py-1 text-gray-400 hover:text-blue-500 text-lg leading-none"
          title="Thêm tab"
        >+</button>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-wrap">
        <select
          value={activeTab?.month}
          onChange={e => changeMonth(activeTab!.id, Number(e.target.value), activeTab!.year)}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
        >
          {monthOptions.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select
          value={activeTab?.year}
          onChange={e => changeMonth(activeTab!.id, activeTab!.month, Number(e.target.value))}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={() => activeTab && refresh(activeTab.id)}
          disabled={activeTab?.refreshing}
          className="text-sm px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {activeTab?.refreshing ? '⟳ Đang làm mới...' : '⟳ Làm mới'}
        </button>
        {remaining > 0 && (
          <span className="text-xs text-gray-400">
            Cache còn {Math.ceil(remaining / 60)} phút
          </span>
        )}
        {d?.updatedAt && (
          <span className="text-xs text-gray-400 ml-auto">
            Cập nhật: {d.updatedAt}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab?.loading && (
          <div className="flex justify-center items-center h-40 text-gray-400">
            <span className="animate-spin text-2xl mr-2">⟳</span> Đang tải...
          </div>
        )}

        {activeTab?.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
            Lỗi: {activeTab.error}
          </div>
        )}

        {d?.empty && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-400 text-sm">
            {d.message ?? `Chưa có dữ liệu tháng ${d.month}/${d.year}`}
          </div>
        )}

        {d && !d.empty && d.tongQuan && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Tổng Form Nhập" value={(d.tongQuan.tongFormNhap ?? 0).toLocaleString()} />
              <KpiCard label="UV Net" value={(d.tongQuan.uvNet ?? 0).toLocaleString()} />
              <KpiCard label="UV Trùng" value={(d.tongQuan.uvTrung ?? 0).toLocaleString()} />
              <KpiCard label="Tỷ Lệ Trùng" value={d.tongQuan.tyLeTrung ?? '0%'} />
            </div>

            {/* Phân loại trạng thái */}
            {d.phanLoaiTrangThai && d.phanLoaiTrangThai.length > 0 && (
              <Section title="Phân loại trạng thái">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="pb-2 font-medium">Trạng thái</th>
                      <th className="pb-2 font-medium text-right">Số lượng</th>
                      <th className="pb-2 font-medium text-right">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.phanLoaiTrangThai.map((row, i) => {
                      const total = d.phanLoaiTrangThai!.reduce((s, r) => s + r.soLuong, 0)
                      const pct = total > 0 ? ((row.soLuong / total) * 100).toFixed(1) : '0'
                      return (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-1.5 text-gray-700 dark:text-gray-300">{row.label}</td>
                          <td className="py-1.5 text-right font-medium">{row.soLuong.toLocaleString()}</td>
                          <td className="py-1.5 text-right text-gray-500">{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-gray-800 dark:text-gray-200">
                      <td className="pt-2">Tổng</td>
                      <td className="pt-2 text-right">
                        {d.phanLoaiTrangThai.reduce((s, r) => s + r.soLuong, 0).toLocaleString()}
                      </td>
                      <td className="pt-2 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </Section>
            )}

            {/* UV theo ngày */}
            {d.uvTheoNgay && d.uvTheoNgay.length > 0 && (
              <Section title={`UV theo ngày — Tháng ${d.month}/${d.year}`}>
                {/* Mini bar chart */}
                <div className="mb-4">
                  {(() => {
                    const max = Math.max(...d.uvTheoNgay!.map(r => r.soLuong), 1)
                    return (
                      <div className="flex items-end gap-0.5 h-24 overflow-x-auto">
                        {d.uvTheoNgay!.map((row, i) => (
                          <div key={i} className="flex flex-col items-center min-w-[18px] group relative">
                            <div
                              className="w-full bg-blue-400 dark:bg-blue-500 rounded-t hover:bg-blue-500 transition-colors"
                              style={{ height: `${(row.soLuong / max) * 80}px` }}
                              title={`${row.ngay}: ${row.soLuong}`}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                              {row.ngay}: {row.soLuong}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="pb-2 font-medium">Ngày</th>
                      <th className="pb-2 font-medium text-right">UV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.uvTheoNgay.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-1 text-gray-700 dark:text-gray-300">{row.ngay}</td>
                        <td className="py-1 text-right font-medium">{row.soLuong.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-gray-800 dark:text-gray-200">
                      <td className="pt-2">Tổng</td>
                      <td className="pt-2 text-right">
                        {d.uvTheoNgay.reduce((s, r) => s + r.soLuong, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
