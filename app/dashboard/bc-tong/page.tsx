'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useState as useLocalState } from 'react'
import { useTabsStore } from '../tabs-store'
import ExportButtons from '@/components/ExportButtons'
import { cacheGet, cacheGetStale, cacheSet, cacheClear } from '@/lib/cache'
import { GroupTotalChart, MonthTrendChart } from '@/components/charts/RecruitChart'
import ComparePanel, { CompareRow } from '@/components/ComparePanel'
import { exportBCTongExcel } from '@/lib/export-utils'
import { useToast } from '@/components/Toast'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { DrilldownPanel } from '@/components/DrilldownPanel'

// ═══════════════════════════════════════════════════════════════════
// TYPES
// Cấu trúc mới v1.36+ — Phần 1 (Đã Lọc) + Phần 2 (Gốc)
// Web API GAS cần trả về cả cleanTongQuan, cleanDuyet/kyHD/daoTao/dauPV,
// cleanMonthCompare, monthCompare và thlCount để hiển thị Bảng 1-2 & 6.
// ═══════════════════════════════════════════════════════════════════

interface StatRow  { label: string; val: number }
interface MonthRow { month: number; val: number }

interface GroupData {
  total:       number
  byMonthNhap: MonthRow[]
  byThiTruong: StatRow[]
  byTrangThai: StatRow[]
  thlCount?:   number    // v1.38: số UV từ nhóm THL
}

/** Một điểm dữ liệu trong bảng so sánh 4 tháng */
interface MonthCompareItem {
  month: number   // 1-12
  year:  number
  kyHD:  number
  duyet: number
}

interface BCTongData {
  month:     number
  year:      number
  updatedAt: string
  empty:     boolean
  message?:  string

  // ── Phần 2: Gốc (Bảng 3-6) — backward-compatible ──────────────
  tongQuan?: { duyet: number; kyHD: number; daoTao: number; dauPV: number }
  duyet?:    GroupData
  kyHD?:     GroupData
  daoTao?:   GroupData
  dauPV?:    GroupData
  monthCompare?: MonthCompareItem[]   // Bảng 6: 4 tháng gần nhất (Gốc)

  // ── Phần 1: Đã Lọc (Bảng 1-2) — mới từ v1.36 ─────────────────
  cleanTongQuan?: { duyet: number; kyHD: number; daoTao: number; dauPV: number }
  cleanDuyet?:    GroupData
  cleanKyHD?:     GroupData
  cleanDaoTao?:   GroupData
  cleanDauPV?:    GroupData
  cleanMonthCompare?: MonthCompareItem[]  // Bảng 2: 4 tháng gần nhất (Đã Lọc)
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG NHÓM & MÀU SẮC
// ═══════════════════════════════════════════════════════════════════

const GROUPS = [
  { key: 'duyet',  label: 'Duyệt',   color: 'blue'   },
  { key: 'kyHD',   label: 'Ký HĐ',   color: 'orange' },
  { key: 'daoTao', label: 'Đào Tạo', color: 'green'  },
  { key: 'dauPV',  label: 'Đậu PV',  color: 'indigo' },
] as const

type GroupKey = 'duyet' | 'kyHD' | 'daoTao' | 'dauPV'

/** Map tên nhóm gốc → tên nhóm clean */
const CLEAN_KEY: Record<GroupKey, keyof BCTongData> = {
  duyet:  'cleanDuyet',
  kyHD:   'cleanKyHD',
  daoTao: 'cleanDaoTao',
  dauPV:  'cleanDauPV',
}

const COLOR: Record<string, { card: string; badge: string; bar: string }> = {
  blue:   { card: 'bg-blue-50 border-blue-100',      badge: 'text-blue-700',    bar: 'bg-blue-500'    },
  orange: { card: 'bg-orange-50 border-orange-100',  badge: 'text-orange-700',  bar: 'bg-orange-500'  },
  green:  { card: 'bg-emerald-50 border-emerald-100',badge: 'text-emerald-700', bar: 'bg-emerald-500' },
  indigo: { card: 'bg-indigo-50 border-indigo-100',  badge: 'text-indigo-700',  bar: 'bg-indigo-500'  },
}

const BAR_COLOR: Record<string, string> = {
  blue: '#3b82f6', orange: '#f97316', green: '#10b981', indigo: '#6366f1',
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-TAB STATE
// ═══════════════════════════════════════════════════════════════════

interface TabState {
  id:         string
  month:      number
  year:       number
  data:       BCTongData | null
  loading:    boolean
  error:      string
  refreshing: boolean
}

interface DrillState {
  label: string
  color: string
  total: number
  rows:  StatRow[]
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT CHÍNH
// ═══════════════════════════════════════════════════════════════════

export default function BCTongPage() {
  const now    = new Date()
  const nextId = useRef(2)
  const { getPage, savePage } = useTabsStore()
  const { toast, dismiss }    = useToast()

  // ── Tabs — khôi phục từ store ──────────────────────────────────
  const [tabs, setTabs] = useState<TabState[]>(() => {
    const s = getPage('bc-tong')
    if (s && s.tabs.length > 0) return s.tabs as TabState[]
    return [{ id: '1', month: now.getMonth() + 1, year: now.getFullYear(), data: null, loading: false, error: '', refreshing: false }]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const s = getPage('bc-tong')
    return s ? s.activeTabId : '1'
  })

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  // ── Drill-down state — tách riêng clean vs gốc để không bị xung đột ──
  const [drillGroupClean, setDrillGroupClean] = useState<DrillState | null>(null)
  const [drillGroup,      setDrillGroup]      = useState<DrillState | null>(null)

  // ── So sánh 2 tab ─────────────────────────────────────────────
  const [compareOpen, setCompareOpen] = useLocalState(false)
  const [compareA, setCompareA]       = useLocalState(() => tabs[0]?.id ?? '1')
  const [compareB, setCompareB]       = useLocalState(() => tabs[1]?.id ?? '1')

  const compareRows = useMemo((): CompareRow[] => {
    const dA = tabs.find(t => t.id === compareA)?.data
    const dB = tabs.find(t => t.id === compareB)?.data
    if (!dA?.tongQuan || !dB?.tongQuan) return []
    const a = dA.tongQuan, b = dB.tongQuan
    const rows: CompareRow[] = [
      { label: 'Tổng quan (Gốc)', a: null, b: null, isSeparator: true },
      { label: 'Duyệt',   a: a.duyet  ?? 0, b: b.duyet  ?? 0 },
      { label: 'Ký HĐ',   a: a.kyHD   ?? 0, b: b.kyHD   ?? 0 },
      { label: 'Đào Tạo', a: a.daoTao ?? 0, b: b.daoTao ?? 0 },
      { label: 'Đậu PV',  a: a.dauPV  ?? 0, b: b.dauPV  ?? 0 },
    ]
    // Clean data (nếu có)
    if (dA.cleanTongQuan && dB.cleanTongQuan) {
      const ca = dA.cleanTongQuan, cb = dB.cleanTongQuan
      rows.push({ label: 'Tổng quan (Đã Lọc)', a: null, b: null, isSeparator: true })
      rows.push({ label: 'Duyệt (lọc)',   a: ca.duyet  ?? 0, b: cb.duyet  ?? 0 })
      rows.push({ label: 'Ký HĐ (lọc)',   a: ca.kyHD   ?? 0, b: cb.kyHD   ?? 0 })
      rows.push({ label: 'Đào Tạo (lọc)', a: ca.daoTao ?? 0, b: cb.daoTao ?? 0 })
      rows.push({ label: 'Đậu PV (lọc)',  a: ca.dauPV  ?? 0, b: cb.dauPV  ?? 0 })
    }
    return rows
  }, [tabs, compareA, compareB])

  // Alias cho tab đang active
  const activeTab  = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const month      = activeTab.month
  const year       = activeTab.year
  const data       = activeTab.data
  const loading    = activeTab.loading
  const error      = activeTab.error
  const refreshing = activeTab.refreshing

  // ── Fetch từ server ────────────────────────────────────────────
  const _fetchFromServer = useCallback(async (m: number, y: number, tabId: string) => {
    const res = await fetch(`/api/reports/bc-tong?month=${m}&year=${y}`)
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
    const d = await res.json()
    cacheSet(`bc-tong:${m}:${y}`, d)
    updateTab(tabId, { data: d })
    return d
  }, [updateTab])

  // ── SWR: cache còn hạn → dùng ngay; stale → show + refetch ngầm ──
  const fetchData = useCallback(async (m: number, y: number, tabId: string, skipCache = false) => {
    if (!skipCache) {
      const fresh = cacheGet<BCTongData>(`bc-tong:${m}:${y}`)
      if (fresh) {
        updateTab(tabId, { data: fresh, loading: false, error: '' })
        toast('info', 'Từ cache', `Dữ liệu T${m}/${y} · còn hạn 30 phút`)
        return
      }
      const stale = cacheGetStale<BCTongData>(`bc-tong:${m}:${y}`)
      if (stale) {
        updateTab(tabId, { data: stale, loading: false, refreshing: true, error: '' })
        try {
          const d = await _fetchFromServer(m, y, tabId)
          toast('success', `Làm mới xong T${m}/${y}`, `Cập nhật: ${d.updatedAt ?? 'vừa xong'}`)
        } catch { /* silent — stale data vẫn hiển thị */ }
        finally { updateTab(tabId, { refreshing: false }) }
        return
      }
    }
    updateTab(tabId, { loading: true, error: '', data: null })
    const loadingId = toast('loading', `Đang tải T${m}/${y}...`)
    try {
      const d = await _fetchFromServer(m, y, tabId)
      dismiss(loadingId)
      toast('success', `Tải xong T${m}/${y}`, `Cập nhật: ${d.updatedAt ?? 'vừa xong'}`)
    } catch (e: any) {
      updateTab(tabId, { error: e.message })
      dismiss(loadingId)
      toast('error', 'Lỗi tải dữ liệu', e.message)
    } finally {
      updateTab(tabId, { loading: false })
    }
  }, [updateTab, toast, dismiss, _fetchFromServer])

  const refreshData = useCallback(async () => {
    const id = activeTabId
    const t  = activeTab
    updateTab(id, { refreshing: true })
    cacheClear(`bc-tong:${t.month}:${t.year}`)
    await fetch(`/api/revalidate?tag=bc-tong`, { method: 'POST' }).catch(() => {})
    await fetchData(t.month, t.year, id, true)
    updateTab(id, { refreshing: false })
  }, [activeTabId, activeTab, updateTab, fetchData])

  // ── Supabase Realtime — tự động refresh khi GAS gửi tín hiệu ──
  useRealtimeRefresh(
    useCallback(() => {
      toast('info', 'Dữ liệu mới!', 'Google Sheets vừa cập nhật — đang tải lại...')
      refreshData()
    }, [toast, refreshData]),
    'bc-tong'
  )

  // Đồng bộ tabs → store
  useEffect(() => { savePage('bc-tong', { tabs, activeTabId }) }, [tabs, activeTabId, savePage])

  useEffect(() => {
    const maxId = Math.max(...tabs.map(t => Number(t.id)))
    if (maxId >= nextId.current) nextId.current = maxId + 1
  }, [])

  // Tải lần đầu
  useEffect(() => {
    const first = tabs[0]
    if (!first.data && !first.loading) fetchData(first.month, first.year, first.id)
  }, [])

  // Deep link — đọc ?month=&year= từ URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const m = Number(p.get('month')), y = Number(p.get('year'))
    if (m >= 1 && m <= 12 && y >= 2020) {
      updateTab(activeTabId, { month: m, year: y })
      fetchData(m, y, activeTabId)
    }
  }, [])

  // Cập nhật URL khi tab thay đổi
  useEffect(() => {
    const u = new URLSearchParams()
    u.set('month', String(month)); u.set('year', String(year))
    window.history.replaceState(null, '', '?' + u.toString())
  }, [month, year])

  // ── Tab management ────────────────────────────────────────────
  const addTab = () => {
    const id = String(nextId.current++)
    const m  = now.getMonth() + 1
    const y  = now.getFullYear()
    const newTab: TabState = { id, month: m, year: y, data: null, loading: false, error: '', refreshing: false }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    fetchData(m, y, id)
  }

  const closeTab = (id: string) => {
    const next = tabs.filter(t => t.id !== id)
    if (next.length === 0) return
    setTabs(next)
    if (activeTabId === id) {
      const idx = tabs.findIndex(t => t.id === id)
      setActiveTabId(next[Math.min(idx, next.length - 1)].id)
    }
  }

  // Click vào bar → mở drill-down theo khu vực
  const handleBarClick = useCallback((bar: { label: string; val: number; color: string }, _: number) => {
    if (!data) return
    const group = GROUPS.find(g => g.label === bar.label)
    if (!group) return
    const grp = data[group.key as GroupKey] as GroupData | undefined
    setDrillGroup({
      label: group.label, color: group.color,
      total: grp?.total ?? bar.val, rows: grp?.byThiTruong ?? [],
    })
  }, [data])

  // Drill-down cho dữ liệu clean (Bảng 1)
  const handleCleanBarClick = useCallback((bar: { label: string; val: number; color: string }, _: number) => {
    if (!data) return
    const group = GROUPS.find(g => g.label === bar.label)
    if (!group) return
    const cleanKey = CLEAN_KEY[group.key as GroupKey]
    const grp = data[cleanKey] as GroupData | undefined
    setDrillGroupClean({
      label: `${group.label} (Đã Lọc)`, color: group.color,
      total: grp?.total ?? bar.val, rows: grp?.byThiTruong ?? [],
    })
  }, [data])

  const tq       = data?.tongQuan
  const cleanTq  = data?.cleanTongQuan
  const hasData  = !!tq
  // Bảng 1 & 2 luôn hiển thị khi có dữ liệu (ngay cả khi GAS chưa trả cleanTongQuan)
  const hasClean = hasData

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── TAB BAR ── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5 overflow-x-auto mb-1">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          return (
            <div key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap
                ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
              onClick={() => setActiveTabId(tab.id)}>
              <span>{tab.loading ? '⏳' : '📊'} T{tab.month}/{tab.year}</span>
              {tabs.length > 1 && (
                <button onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  className="ml-1 text-slate-400 hover:text-red-400 transition leading-none">×</button>
              )}
            </div>
          )
        })}
        <button onClick={addTab}
          className="px-2.5 py-1.5 text-slate-400 hover:text-blue-600 hover:bg-white/60 rounded-lg transition text-base font-bold leading-none"
          title="Mở tab mới">+</button>
        {tabs.length >= 2 && (
          <button onClick={() => { setCompareA(tabs[0].id); setCompareB(tabs[1].id); setCompareOpen(true) }}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition whitespace-nowrap no-print"
            title="So sánh 2 tab">⚖️ So sánh</button>
        )}
      </div>

      {/* ── Tiêu đề & bộ lọc ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Báo Cáo Tổng {String(month).padStart(2, '0')}/{year}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Thống kê UV đậu PV / đào tạo / ký HĐ / duyệt
            {data && !data.empty && ` · Cập nhật: ${data.updatedAt}`}
            {refreshing && <span className="ml-2 text-amber-500">↻ Đang làm mới...</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select value={month}
            onChange={e => { const m = Number(e.target.value); updateTab(activeTabId, { month: m }); fetchData(m, activeTab.year, activeTabId) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={year}
            onChange={e => { const y = Number(e.target.value); updateTab(activeTabId, { year: y }); fetchData(activeTab.month, y, activeTabId) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => fetchData(month, year, activeTabId)} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Đang tải...' : 'Xem'}
          </button>
          <button onClick={refreshData} disabled={loading || refreshing}
            title="Xoá cache và tải dữ liệu mới nhất từ Google Sheets"
            className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-50 transition">
            {refreshing ? '...' : '🔄'}
          </button>
          <ExportButtons
            disabled={!data || loading}
            onExcelClick={() => data && exportBCTongExcel(data, `T${month}-${year}`)}
          />
        </div>
      </div>

      {/* ── Trạng thái loading / error / empty ── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Đang tải dữ liệu...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}
      {data?.empty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">
          📭 {data.message}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PHẦN 1: SỐ LIỆU ĐÃ LỌC (Bảng 1 & 2)
          Dữ liệu deduplicate: loại UV trùng SĐT + "TX Nghỉ Việc" + "Nhập lại"
          ══════════════════════════════════════════════════════════ */}
      {hasClean && (
        <>
          {/* Banner phần 1 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-green-200" />
            <span className="px-4 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-semibold text-green-700 tracking-wide">
              ✅ SỐ LIỆU ĐÃ LỌC
            </span>
            <div className="flex-1 h-px bg-green-200" />
          </div>
          <p className="text-xs text-slate-400 -mt-3 text-center">
            Đã loại UV trùng SĐT xuyên nhóm · Đã loại trạng thái "TX Nghỉ Việc" và "Nhập lại"
          </p>

          {/* ── Bảng 1: Tổng quan 4 nhóm (Đã Lọc) ─────────────────── */}
          <Section title={`Bảng 1 — Tổng quan chuyển đổi T${String(month).padStart(2,'0')}/${year} (Đã Lọc)`} badge="Đã Lọc" badgeColor="green">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {GROUPS.map(g => {
                const cleanKey = CLEAN_KEY[g.key as GroupKey]
                const grp      = data![cleanKey] as GroupData | undefined
                return (
                  <div key={g.key} className={`rounded-xl border p-4 ${COLOR[g.color].card}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${COLOR[g.color].badge}`}>
                      {g.label}
                    </p>
                    <p className="text-3xl font-bold text-slate-900">
                      {cleanTq?.[g.key as GroupKey] ?? 0}
                    </p>
                    {grp?.thlCount ? (
                      <p className="text-xs text-slate-400 mt-1">
                        (trong đó THL: {grp.thlCount})
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">UV trong T{month}/{year}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Biểu đồ tổng quan clean */}
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">💡 Click vào cột để xem chi tiết theo khu vực</p>
              <GroupTotalChart
                data={GROUPS.map(g => ({
                  label: g.label,
                  val:   cleanTq?.[g.key as GroupKey] ?? 0,
                  color: BAR_COLOR[g.color] ?? '#94a3b8',
                }))}
                onBarClick={handleCleanBarClick}
              />
            </div>

            {/* Drill-down panel (clean) */}
            {drillGroupClean && (
              <div className="mt-4">
                <DrilldownPanel
                  label={drillGroupClean.label}
                  color={drillGroupClean.color}
                  total={drillGroupClean.total}
                  rows={drillGroupClean.rows}
                  onClose={() => setDrillGroupClean(null)}
                />
              </div>
            )}
          </Section>

          {/* ── Bảng 2: So sánh KÝ HĐ & DUYỆT 4 tháng (Đã Lọc) ──── */}
          <Section title="Bảng 2 — So sánh Ký HĐ & Duyệt 4 tháng gần nhất (Đã Lọc)" badge="Đã Lọc" badgeColor="green">
            {data?.cleanMonthCompare && data.cleanMonthCompare.length > 0
              ? <MonthCompareTable items={data.cleanMonthCompare} />
              : <p className="text-xs text-slate-400 py-2">Chưa có dữ liệu so sánh (cần GAS v1.38+)</p>
            }
          </Section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          DIVIDER — PHẦN 1 / PHẦN 2
          ══════════════════════════════════════════════════════════ */}
      {(hasClean || hasData) && (
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-slate-300" />
          <span className="px-4 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-xs font-semibold text-slate-500 tracking-wide">
            📊 SỐ LIỆU GỐC
          </span>
          <div className="flex-1 h-px bg-slate-300" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PHẦN 2: SỐ LIỆU GỐC (Bảng 3-6)
          Toàn bộ dữ liệu chưa lọc, bao gồm THL
          ══════════════════════════════════════════════════════════ */}
      {hasData && (
        <>
          {/* ── Bảng 3: Tổng quan 4 nhóm (Gốc) ──────────────────────── */}
          <Section title={`Bảng 3 — Tổng quan T${String(month).padStart(2,'0')}/${year} (Gốc)`} badge="Gốc" badgeColor="slate">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {GROUPS.map(g => {
                const grp = data![g.key as GroupKey] as GroupData | undefined
                return (
                  <div key={g.key} className={`rounded-xl border p-4 ${COLOR[g.color].card}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${COLOR[g.color].badge}`}>
                      {g.label}
                    </p>
                    <p className="text-3xl font-bold text-slate-900">
                      {tq![g.key as GroupKey]}
                    </p>
                    {grp?.thlCount ? (
                      <p className="text-xs text-slate-400 mt-1">(trong đó THL: {grp.thlCount})</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">UV trong T{month}/{year}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">💡 Click vào cột để xem chi tiết theo khu vực</p>
              <GroupTotalChart
                data={GROUPS.map(g => ({
                  label: g.label,
                  val:   tq![g.key as GroupKey],
                  color: BAR_COLOR[g.color] ?? '#94a3b8',
                }))}
                onBarClick={handleBarClick}
              />
            </div>

            {/* Drill-down panel (gốc) */}
            {drillGroup && (
              <div className="mt-4">
                <DrilldownPanel
                  label={drillGroup.label}
                  color={drillGroup.color}
                  total={drillGroup.total}
                  rows={drillGroup.rows}
                  onClose={() => setDrillGroup(null)}
                />
              </div>
            )}
          </Section>

          {/* ── Bảng 4: Chi tiết từng nhóm (Gốc) ──────────────────────── */}
          <Section title="Bảng 4 — Chi tiết theo nhóm (Gốc)" badge="Gốc" badgeColor="slate">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {GROUPS.map(g => {
                const grp = data![g.key as GroupKey] as GroupData | undefined
                if (!grp || grp.total === 0) return null
                return <GroupCard key={g.key} label={g.label} color={g.color} grp={grp} />
              })}
            </div>
          </Section>

          {/* ── Bảng 5: Tháng nhập UV (Gốc) ────────────────────────────── */}
          <Section title="Bảng 5 — Tháng nhập UV theo nhóm phễu (Gốc)" badge="Gốc" badgeColor="slate">
            <MonthTable data={data!} />
            <div className="mt-4">
              <MonthTrendChart
                months={Array.from({ length: 12 }, (_, i) => i + 1)}
                groups={GROUPS.map(g => ({
                  label: g.label,
                  color: BAR_COLOR[g.color] ?? '#94a3b8',
                  data:  (data![g.key as GroupKey] as GroupData | undefined)?.byMonthNhap ?? [],
                }))}
              />
            </div>
          </Section>

          {/* ── Bảng 6: So sánh KÝ HĐ & DUYỆT 4 tháng (Gốc) ──────────── */}
          <Section title="Bảng 6 — So sánh Ký HĐ & Duyệt 4 tháng gần nhất (Gốc)" badge="Gốc" badgeColor="slate">
            {data?.monthCompare && data.monthCompare.length > 0
              ? <MonthCompareTable items={data.monthCompare} />
              : <p className="text-xs text-slate-400 py-2">Chưa có dữ liệu so sánh (cần GAS v1.38+)</p>
            }
          </Section>
        </>
      )}

      {/* ── Compare Panel ── */}
      {compareOpen && (
        <ComparePanel
          tabs={tabs.map(t => ({ id: t.id, label: `T${t.month}/${t.year}`, hasData: !!t.data }))}
          tabAId={compareA} tabBId={compareB}
          onTabAChange={setCompareA} onTabBChange={setCompareB}
          rows={compareRows}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/** Section wrapper với badge nhãn dữ liệu */
function Section({
  title, children, badge, badgeColor,
}: {
  title: string
  children: React.ReactNode
  badge?: string
  badgeColor?: 'green' | 'slate'
}) {
  const badgeCls = badgeColor === 'green'
    ? 'bg-green-100 text-green-700 border border-green-200'
    : 'bg-slate-100 text-slate-500 border border-slate-200'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {badge && (
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeCls}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/** Card chi tiết 1 nhóm (byTrangThai + byThiTruong) */
function GroupCard({ label, color, grp }: { label: string; color: string; grp: GroupData }) {
  const c     = COLOR[color]
  const topTT = grp.byTrangThai.slice(0, 8)
  const topKV = grp.byThiTruong.slice(0, 6)

  return (
    <div className={`rounded-xl border p-4 ${c.card}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-bold ${c.badge}`}>{label}</span>
        <div className="flex items-center gap-2">
          {grp.thlCount ? (
            <span className="text-xs text-slate-400 bg-white/60 rounded px-1.5 py-0.5">
              THL: {grp.thlCount}
            </span>
          ) : null}
          <span className={`text-xl font-bold ${c.badge}`}>{grp.total}</span>
        </div>
      </div>

      {topTT.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1.5">Trạng thái</p>
          <div className="space-y-1.5">
            {topTT.map((r, i) => {
              const pct = Math.round((r.val / grp.total) * 100)
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600 truncate max-w-[70%]">{r.label}</span>
                    <span className="font-medium text-slate-700">{r.val}</span>
                  </div>
                  <div className="bg-white/60 rounded-full h-1.5">
                    <div className={`${c.bar} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {topKV.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Khu vực</p>
          <div className="flex flex-wrap gap-1.5">
            {topKV.map((r, i) => (
              <span key={i} className="text-xs bg-white/70 rounded-lg px-2 py-1 text-slate-700">
                {r.label} <span className={`font-bold ${c.badge}`}>{r.val}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Bảng tháng nhập UV cross nhóm */
function MonthTable({ data }: { data: BCTongData }) {
  const monthSet = new Set<number>()
  GROUPS.forEach(g => {
    const grp = data[g.key as GroupKey] as GroupData | undefined
    grp?.byMonthNhap.forEach(r => monthSet.add(r.month))
  })
  const months = Array.from(monthSet).sort((a, b) => a - b)
  if (months.length === 0) return <p className="text-sm text-slate-400">Không có dữ liệu</p>

  function getVal(grp: GroupData | undefined, m: number) {
    return grp?.byMonthNhap.find(r => r.month === m)?.val ?? 0
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-2 px-3 text-slate-500 font-medium">Tháng nhập</th>
            {GROUPS.map(g => (
              <th key={g.key} className={`text-right py-2 px-3 font-medium ${COLOR[g.color].badge}`}>
                {g.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2 px-3 text-slate-600">Tháng {m}</td>
              {GROUPS.map(g => {
                const v = getVal(data[g.key as GroupKey] as GroupData | undefined, m)
                return (
                  <td key={g.key} className="py-2 px-3 text-right font-semibold text-slate-800">
                    {v > 0 ? v : <span className="text-slate-300">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Bảng so sánh KÝ HĐ & DUYỆT theo 4 tháng gần nhất (Bảng 2 & Bảng 6) */
function MonthCompareTable({ items }: { items: MonthCompareItem[] }) {
  const sorted = [...items].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  const maxVal = Math.max(...sorted.flatMap(r => [r.kyHD, r.duyet]), 1)

  return (
    <div className="space-y-4">
      {/* Bảng số liệu */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-slate-500 font-medium">Tháng</th>
              <th className="text-right py-2 px-3 font-medium text-orange-600">Ký HĐ</th>
              <th className="text-right py-2 px-3 font-medium text-blue-600">Duyệt</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium">Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const diff = r.kyHD - r.duyet
              return (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-600 font-medium">
                    T{String(r.month).padStart(2,'0')}/{r.year}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-orange-700">{r.kyHD}</td>
                  <td className="py-2 px-3 text-right font-semibold text-blue-700">{r.duyet}</td>
                  <td className={`py-2 px-3 text-right text-xs font-medium ${diff > 0 ? 'text-orange-500' : diff < 0 ? 'text-blue-500' : 'text-slate-400'}`}>
                    {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Biểu đồ thanh ngang đơn giản */}
      <div className="space-y-3 mt-2">
        {sorted.map((r, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-medium">T{String(r.month).padStart(2,'0')}/{r.year}</span>
            </div>
            {/* Ký HĐ */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-14 text-right text-xs text-orange-600 font-medium shrink-0">Ký HĐ</span>
              <div className="flex-1 bg-orange-100 rounded-full h-5 relative">
                <div
                  className="bg-orange-500 h-5 rounded-full transition-all"
                  style={{ width: `${(r.kyHD / maxVal) * 100}%` }}
                />
                <span className="absolute right-2 top-0 h-5 flex items-center text-xs font-bold text-white mix-blend-multiply">
                  {r.kyHD}
                </span>
              </div>
            </div>
            {/* Duyệt */}
            <div className="flex items-center gap-2">
              <span className="w-14 text-right text-xs text-blue-600 font-medium shrink-0">Duyệt</span>
              <div className="flex-1 bg-blue-100 rounded-full h-5 relative">
                <div
                  className="bg-blue-500 h-5 rounded-full transition-all"
                  style={{ width: `${(r.duyet / maxVal) * 100}%` }}
                />
                <span className="absolute right-2 top-0 h-5 flex items-center text-xs font-bold text-white mix-blend-multiply">
                  {r.duyet}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
