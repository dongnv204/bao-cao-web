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

interface PhanLoaiRow { label: string; soLuong: number }

interface UVTheoNgayRow {
  ngay: string
  thu?: string
  formNhap?: number
  uvNet?: number
  trung?: number
  pctTrung?: string
  moApp?: number | string
  nopHS?: number | string
  loai?: number | string
  taiTuyen?: number | string
  txct?: number | string
  trongTT?: number | string
  // fallback nếu API chỉ trả về đơn giản
  soLuong?: number
}

interface ThiTruongRow {
  thiTruong: string
  soUV: number
}

interface BCPlatformData {
  month: number
  year: number
  updatedAt: string
  empty: boolean
  message?: string
  tongQuan?: TongQuan
  phanLoaiTrangThai?: PhanLoaiRow[]
  uvTheoNgay?: UVTheoNgayRow[]
  thiTruong?: ThiTruongRow[]
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

// ── Màu sắc cho phân loại trạng thái ──────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  'Đã mở app':       { bg: 'from-blue-500 to-blue-700',     text: 'text-blue-100', icon: '📱' },
  'Đã nộp HS online':{ bg: 'from-teal-500 to-teal-700',     text: 'text-teal-100', icon: '📄' },
  'Loại':            { bg: 'from-gray-500 to-gray-700',     text: 'text-gray-100', icon: '✗' },
  'Tái Tuyển':       { bg: 'from-orange-400 to-orange-600', text: 'text-orange-100', icon: '🔄' },
  'TXCT':            { bg: 'from-indigo-500 to-indigo-700', text: 'text-indigo-100', icon: '📋' },
  'Trống (chưa có TT)': { bg: 'from-purple-500 to-purple-700', text: 'text-purple-100', icon: '⬜' },
}
const STATUS_COLORS_DEFAULT = [
  { bg: 'from-blue-500 to-blue-700',   text: 'text-blue-100',   icon: '📊' },
  { bg: 'from-green-500 to-green-700', text: 'text-green-100',  icon: '✓' },
  { bg: 'from-red-500 to-red-700',     text: 'text-red-100',    icon: '✗' },
  { bg: 'from-orange-400 to-orange-600', text: 'text-orange-100', icon: '⚡' },
  { bg: 'from-indigo-500 to-indigo-700', text: 'text-indigo-100', icon: '📋' },
  { bg: 'from-purple-500 to-purple-700', text: 'text-purple-100', icon: '⬜' },
]

// ── Sub-components ─────────────────────────────────────────────────────

// KPI Card lớn với gradient và icon
function KpiCard({
  label, value, sub, gradient, icon,
}: {
  label: string; value: string | number; sub?: string
  gradient: string; icon: string
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} text-white rounded-2xl px-5 py-4 shadow-lg relative overflow-hidden`}>
      {/* Decorative circle */}
      <div className="absolute -top-3 -right-3 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -right-6 w-28 h-28 rounded-full bg-white/5" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">{label}</p>
          <span className="text-xl opacity-90">{icon}</span>
        </div>
        <p className="text-3xl font-extrabold leading-none">{value}</p>
        {sub && <p className="text-xs opacity-70 mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}

// Section wrapper với border accent đẹp
function Section({
  title, subtitle, children, icon,
}: {
  title: string; subtitle?: string; children: React.ReactNode; icon?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-750 border-b border-slate-200 dark:border-gray-700 flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        <div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-gray-200 tracking-wide">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// Status card nhỏ cho Phân Loại Trạng Thái
function StatusCard({ label, value, gradient, textColor, icon, totalUVNet }: {
  label: string; value: number; gradient: string; textColor: string; icon: string; totalUVNet: number
}) {
  const pct = totalUVNet > 0 ? Math.round((value / totalUVNet) * 100) : 0
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl px-4 py-3 text-white shadow-md relative overflow-hidden`}>
      <div className="absolute -top-2 -right-2 w-14 h-14 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg">{icon}</span>
          <span className={`text-xs ${textColor} opacity-80`}>{pct}%</span>
        </div>
        <p className="text-2xl font-extrabold leading-none">{value}</p>
        <p className="text-xs opacity-75 mt-1 leading-tight">{label}</p>
      </div>
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

  useEffect(() => {
    tabs.forEach(t => {
      if (!t.data && !t.loading) fetchData(t.id, t.month, t.year)
    })
  }, []) // eslint-disable-line

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

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearOptions  = [now.getFullYear() - 1, now.getFullYear()]

  // ── Render ─────────────────────────────────────────────────────────
  const d = activeTab?.data
  const tq = d?.tongQuan
  const remaining = activeTab
    ? cacheRemainingSeconds(`bc-platform:${activeTab.month}:${activeTab.year}`)
    : 0

  // Detect nếu uvTheoNgay có đủ cột (multi-column)
  const hasDetailedDaily = d?.uvTheoNgay?.some(r => r.uvNet !== undefined || r.formNhap !== undefined)

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-900">

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 px-3 pt-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-x-auto shrink-0">
        {tabs.map(t => (
          <div
            key={t.id}
            onClick={() => setActiveTabId(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-sm cursor-pointer whitespace-nowrap border-b-2 transition-all ${
              t.id === activeTabId
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <span>Tháng {t.month}/{t.year}</span>
            {t.loading && <span className="animate-spin text-xs opacity-60">⟳</span>}
            {tabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); closeTab(t.id) }}
                className="ml-0.5 text-gray-300 hover:text-red-400 text-xs"
              >✕</button>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          className="ml-1 px-2.5 py-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg text-lg transition-colors"
          title="Thêm tab"
        >+</button>
      </div>

      {/* ── Header / Controls ── */}
      <div className="shrink-0 px-5 py-3 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              📊 BC Platform — Tháng {activeTab?.month}/{activeTab?.year}
            </h1>
            {d?.updatedAt && (
              <p className="text-xs text-slate-400 mt-0.5">Cập nhật: {d.updatedAt}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={activeTab?.month}
              onChange={e => changeMonth(activeTab!.id, Number(e.target.value), activeTab!.year)}
              className="text-sm border border-slate-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {monthOptions.map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select
              value={activeTab?.year}
              onChange={e => changeMonth(activeTab!.id, activeTab!.month, Number(e.target.value))}
              className="text-sm border border-slate-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => activeTab && refresh(activeTab.id)}
              disabled={activeTab?.refreshing}
              className="text-sm px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <span className={activeTab?.refreshing ? 'animate-spin inline-block' : ''}>⟳</span>
              {activeTab?.refreshing ? 'Đang làm mới...' : 'Làm mới'}
            </button>
            {remaining > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                Cache {Math.ceil(remaining / 60)} phút
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* Loading */}
        {activeTab?.loading && (
          <div className="flex justify-center items-center h-48">
            <div className="text-center text-slate-400">
              <div className="text-4xl animate-spin mb-3">⟳</div>
              <p className="text-sm">Đang tải dữ liệu...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {activeTab?.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Lỗi tải dữ liệu</p>
              <p className="opacity-80 mt-0.5">{activeTab.error}</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {d?.empty && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
            <span className="text-lg">📭</span>
            <p>{d.message ?? `Chưa có dữ liệu tháng ${d.month}/${d.year}`}</p>
          </div>
        )}

        {d && !d.empty && tq && (
          <>
            {/* ══ BẢNG 1: KPI Tổng Quan ══ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Tổng Form Nhập"
                value={(tq.tongFormNhap ?? 0).toLocaleString()}
                gradient="from-blue-500 to-blue-700"
                icon="📝"
              />
              <KpiCard
                label="UV Net"
                value={(tq.uvNet ?? 0).toLocaleString()}
                gradient="from-emerald-500 to-emerald-700"
                icon="✅"
              />
              <KpiCard
                label="UV Trùng (bị loại)"
                value={(tq.uvTrung ?? 0).toLocaleString()}
                sub={`${tq.tyLeTrung} tỷ lệ trùng`}
                gradient="from-rose-500 to-rose-700"
                icon="❌"
              />
              <KpiCard
                label="Tỷ Lệ Trùng"
                value={tq.tyLeTrung ?? '0%'}
                gradient="from-violet-500 to-violet-700"
                icon="📊"
              />
            </div>

            {/* ══ Phân Loại Trạng Thái ══ */}
            {d.phanLoaiTrangThai && d.phanLoaiTrangThai.length > 0 && (
              <Section
                title={`Phân Loại Trạng Thái — UV Net (${tq.uvNet} UV)`}
                icon="🏷️"
              >
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {d.phanLoaiTrangThai.map((row, i) => {
                    const colorCfg = STATUS_COLORS[row.label] ?? STATUS_COLORS_DEFAULT[i % STATUS_COLORS_DEFAULT.length]
                    return (
                      <StatusCard
                        key={i}
                        label={row.label}
                        value={row.soLuong}
                        gradient={colorCfg.bg}
                        textColor={colorCfg.text}
                        icon={colorCfg.icon}
                        totalUVNet={tq.uvNet ?? 0}
                      />
                    )
                  })}
                </div>
                {/* Progress bar tổng */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-700">
                  <div className="flex gap-3 flex-wrap">
                    {d.phanLoaiTrangThai.map((row, i) => {
                      const colorCfg = STATUS_COLORS[row.label] ?? STATUS_COLORS_DEFAULT[i % STATUS_COLORS_DEFAULT.length]
                      const pct = tq.uvNet > 0 ? (row.soLuong / tq.uvNet) * 100 : 0
                      // Lấy màu đầu tiên từ gradient string
                      const tailwindBg = colorCfg.bg.split(' ')[0].replace('from-', 'bg-').replace('to-', 'bg-')
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${colorCfg.bg}`} />
                          <span>{row.label}: <strong>{row.soLuong}</strong> ({pct.toFixed(1)}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Section>
            )}

            {/* ══ BẢNG 2: UV Theo Ngày ══ */}
            {d.uvTheoNgay && d.uvTheoNgay.length > 0 && (
              <Section
                title={`Bảng 2 — Chỉ số UV từng ngày`}
                subtitle={`Tháng ${d.month}/${d.year}`}
                icon="📅"
              >
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs">
                        <th className="py-2.5 px-3 text-left font-semibold rounded-tl-lg whitespace-nowrap">Ngày</th>
                        {hasDetailedDaily && (
                          <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">Thứ</th>
                        )}
                        {hasDetailedDaily && (
                          <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Form Nhập</th>
                        )}
                        <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">UV Net</th>
                        {hasDetailedDaily && (
                          <>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap text-red-200">Trùng</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap text-red-200">% Trùng</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Mở App</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Nộp HS</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Loại</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Tái Tuyển</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">TXCT</th>
                            <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap rounded-tr-lg">Trống TT</th>
                          </>
                        )}
                        {!hasDetailedDaily && (
                          <th className="py-2.5 px-3 text-right font-semibold rounded-tr-lg whitespace-nowrap">UV</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {d.uvTheoNgay.map((row, i) => {
                        const uvVal = row.uvNet ?? row.soLuong ?? 0
                        const isOdd = i % 2 === 0
                        return (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 dark:border-gray-700 hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors ${
                              isOdd ? 'bg-white dark:bg-gray-800' : 'bg-slate-50/60 dark:bg-gray-800/60'
                            }`}
                          >
                            <td className="py-2 px-3 text-slate-700 dark:text-gray-300 font-medium whitespace-nowrap">{row.ngay}</td>
                            {hasDetailedDaily && (
                              <td className="py-2 px-3 text-center text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">{row.thu ?? '—'}</td>
                            )}
                            {hasDetailedDaily && (
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-gray-300 whitespace-nowrap">
                                {row.formNhap != null ? row.formNhap.toLocaleString() : '—'}
                              </td>
                            )}
                            <td className="py-2 px-3 text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {uvVal.toLocaleString()}
                            </td>
                            {hasDetailedDaily && (
                              <>
                                <td className="py-2 px-3 text-right text-rose-500 dark:text-rose-400 whitespace-nowrap">
                                  {row.trung != null ? row.trung : '—'}
                                </td>
                                <td className="py-2 px-3 text-right text-rose-400 dark:text-rose-300 text-xs whitespace-nowrap">
                                  {row.pctTrung ?? '—'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                                  {row.moApp != null && row.moApp !== '' ? row.moApp : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                                  {row.nopHS != null && row.nopHS !== '' ? row.nopHS : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                                  {row.loai != null && row.loai !== '' ? row.loai : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                                  {row.taiTuyen != null && row.taiTuyen !== '' ? row.taiTuyen : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                                  {row.txct != null && row.txct !== '' ? row.txct : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="py-2 px-3 text-right text-purple-500 dark:text-purple-400 whitespace-nowrap">
                                  {row.trongTT != null && row.trongTT !== '' ? row.trongTT : <span className="text-slate-300">—</span>}
                                </td>
                              </>
                            )}
                            {!hasDetailedDaily && (
                              <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-gray-300 whitespace-nowrap">
                                {uvVal.toLocaleString()}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 dark:bg-blue-900/30 border-t-2 border-blue-200 dark:border-blue-700 font-bold text-blue-700 dark:text-blue-300">
                        <td className="py-2.5 px-3 text-sm" colSpan={hasDetailedDaily ? 3 : 1}>TỔNG</td>
                        <td className="py-2.5 px-3 text-right text-base">
                          {d.uvTheoNgay
                            .reduce((s, r) => s + (r.uvNet ?? r.soLuong ?? 0), 0)
                            .toLocaleString()}
                        </td>
                        {hasDetailedDaily && (
                          <>
                            <td className="py-2.5 px-3 text-right text-rose-600">
                              {d.uvTheoNgay.reduce((s, r) => s + (r.trung ?? 0), 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-slate-400">
                              {tq.tyLeTrung}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {d.uvTheoNgay.reduce((s, r) => s + (Number(r.moApp) || 0), 0) || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {d.uvTheoNgay.reduce((s, r) => s + (Number(r.nopHS) || 0), 0) || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {d.uvTheoNgay.reduce((s, r) => s + (Number(r.loai) || 0), 0) || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {d.uvTheoNgay.reduce((s, r) => s + (Number(r.taiTuyen) || 0), 0) || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {d.uvTheoNgay.reduce((s, r) => s + (Number(r.txct) || 0), 0) || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-purple-600">
                              {d.uvTheoNgay.reduce((s, r) => s + (Number(r.trongTT) || 0), 0) || '—'}
                            </td>
                          </>
                        )}
                        {!hasDetailedDaily && (
                          <td className="py-2.5 px-3 text-right">
                            {d.uvTheoNgay.reduce((s, r) => s + (r.soLuong ?? 0), 0).toLocaleString()}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            )}

            {/* ══ BẢNG 3: Thị Trường ══ */}
            {d.thiTruong && d.thiTruong.length > 0 && (
              <Section
                title="Bảng 3 — Thị Trường (UV Net theo khu vực)"
                icon="🗺️"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-600 to-slate-700 text-white text-xs">
                        <th className="py-2.5 px-4 text-left font-semibold rounded-tl-lg">Thị Trường</th>
                        <th className="py-2.5 px-4 text-right font-semibold">Số UV</th>
                        <th className="py-2.5 px-4 text-right font-semibold rounded-tr-lg">Tỷ lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.thiTruong.map((row, i) => {
                        const total = d.thiTruong!.reduce((s, r) => s + r.soUV, 0)
                        const pct = total > 0 ? ((row.soUV / total) * 100).toFixed(1) : '0'
                        const barW = total > 0 ? (row.soUV / total) * 100 : 0
                        return (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 dark:border-gray-700 hover:bg-slate-50/60 dark:hover:bg-gray-700/30 transition-colors ${
                              i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-slate-50/50 dark:bg-gray-800/60'
                            }`}
                          >
                            <td className="py-2.5 px-4 text-slate-700 dark:text-gray-300 font-medium">
                              {row.thiTruong}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-slate-800 dark:text-gray-200">
                              {row.soUV.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full"
                                    style={{ width: `${barW}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 dark:bg-blue-900/30 border-t-2 border-blue-200 dark:border-blue-700 font-bold text-blue-700 dark:text-blue-300">
                        <td className="py-2.5 px-4">
                          Tổng số thị trường: {d.thiTruong.length}
                        </td>
                        <td className="py-2.5 px-4 text-right text-base">
                          {d.thiTruong.reduce((s, r) => s + r.soUV, 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right text-sm">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            )}

            {/* Fallback nếu không có thiTruong nhưng có phanLoaiTrangThai (tóm tắt) */}
            {!d.thiTruong && d.phanLoaiTrangThai && (
              <Section title="Tóm tắt tổng quan" icon="📋">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-2xl font-bold text-blue-600">{tq.tongFormNhap?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">Tổng Form Nhập</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-2xl font-bold text-emerald-600">{tq.uvNet?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">UV Net (Hợp lệ)</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20">
                    <p className="text-2xl font-bold text-rose-600">{tq.uvTrung?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">UV Trùng</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20">
                    <p className="text-2xl font-bold text-violet-600">{tq.tyLeTrung}</p>
                    <p className="text-xs text-slate-500 mt-1">Tỷ Lệ Trùng</p>
                  </div>
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
