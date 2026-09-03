'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTabsStore } from '../tabs-store'
import { useMemo, useState as useLocalState } from 'react'
import ExportButtons from '@/components/ExportButtons'
import ComparePanel, { CompareRow } from '@/components/ComparePanel'
import { exportBCTongExcel } from '@/lib/export-utils'

// ── Types ─────────────────────────────────────────────────────────────
interface StatRow   { label: string; val: number }
interface MonthRow  { month: number; val: number }

interface GroupData {
  total:       number
  byMonthNhap: MonthRow[]
  byThiTruong: StatRow[]
  byTrangThai: StatRow[]
}

interface BCTongData {
  month:     number
  year:      number
  updatedAt: string
  empty:     boolean
  message?:  string
  tongQuan?: { duyet: number; kyHD: number; daoTao: number; dauPV: number }
  duyet?:    GroupData
  kyHD?:     GroupData
  daoTao?:   GroupData
  dauPV?:    GroupData
}

// ── Config nhóm ───────────────────────────────────────────────────────
const GROUPS = [
  { key: 'duyet',  label: 'Duyệt',    color: 'blue'   },
  { key: 'kyHD',   label: 'Ký HĐ',    color: 'orange' },
  { key: 'daoTao', label: 'Đào Tạo',  color: 'green'  },
  { key: 'dauPV',  label: 'Đậu PV',   color: 'indigo' },
] as const

type GroupKey = 'duyet' | 'kyHD' | 'daoTao' | 'dauPV'

// ── Màu sắc ───────────────────────────────────────────────────────────
const COLOR: Record<string, { card: string; badge: string; bar: string }> = {
  blue:   { card: 'bg-blue-50 border-blue-100',   badge: 'text-blue-700',   bar: 'bg-blue-500'   },
  orange: { card: 'bg-orange-50 border-orange-100', badge: 'text-orange-700', bar: 'bg-orange-500' },
  green:  { card: 'bg-emerald-50 border-emerald-100', badge: 'text-emerald-700', bar: 'bg-emerald-500' },
  indigo: { card: 'bg-indigo-50 border-indigo-100', badge: 'text-indigo-700', bar: 'bg-indigo-500' },
}

// ── Component chính ───────────────────────────────────────────────────

// ── Multi-tab state ────────────────────────────────────────────────────
interface TabState {
  id: string
  month: number
  year: number
  data: BCTongData | null
  loading: boolean
  error: string
  refreshing: boolean
}

export default function BCTongPage() {
  const now    = new Date()
  const nextId  = useRef(2)
  const { getPage, savePage } = useTabsStore()

  // ── Tabs — khôi phục từ store nếu đã từng mở trang này ───────────────
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

  // ── So sánh 2 tab ─────────────────────────────────────────────────
  const [compareOpen, setCompareOpen] = useLocalState(false)
  const [compareA, setCompareA]       = useLocalState(() => tabs[0]?.id ?? '1')
  const [compareB, setCompareB]       = useLocalState(() => tabs[1]?.id ?? '1')

  const compareRows = useMemo((): CompareRow[] => {
    const dA = tabs.find(t => t.id === compareA)?.data
    const dB = tabs.find(t => t.id === compareB)?.data
    if (!dA?.tongQuan || !dB?.tongQuan) return []
    const a = dA.tongQuan, b = dB.tongQuan
    const rows: CompareRow[] = [
      { label: 'Tổng quan', a: null, b: null, isSeparator: true },
      { label: 'Duyệt',    a: a.duyet  ?? 0, b: b.duyet  ?? 0 },
      { label: 'Ký HĐ',    a: a.kyHD   ?? 0, b: b.kyHD   ?? 0 },
      { label: 'Đào Tạo',  a: a.daoTao ?? 0, b: b.daoTao ?? 0 },
      { label: 'Đậu PV',   a: a.dauPV  ?? 0, b: b.dauPV  ?? 0 },
    ]
    // Chi tiết từng nhóm
    const groups: { key: 'duyet'|'kyHD'|'daoTao'|'dauPV'; label: string }[] = [
      { key: 'duyet', label: 'Duyệt' }, { key: 'kyHD', label: 'Ký HĐ' },
      { key: 'daoTao', label: 'Đào Tạo' }, { key: 'dauPV', label: 'Đậu PV' },
    ]
    for (const g of groups) {
      const gA = (dA as any)[g.key], gB = (dB as any)[g.key]
      if (!gA && !gB) continue
      rows.push({ label: g.label + ' — Chi tiết', a: null, b: null, isSeparator: true })
      rows.push({ label: 'Tổng', a: gA?.total ?? 0, b: gB?.total ?? 0 })
    }
    return rows
  }, [tabs, compareA, compareB])

  // Alias — JSX bên dưới không cần sửa
  const activeTab  = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const month      = activeTab.month
  const year       = activeTab.year
  const data       = activeTab.data
  const loading    = activeTab.loading
  const error      = activeTab.error
  const refreshing = activeTab.refreshing

  // Tải dữ liệu cho 1 tab cụ thể
  const fetchData = useCallback(async (m: number, y: number, tabId: string) => {
    updateTab(tabId, { loading: true, error: '', data: null })
    try {
      const res = await fetch(`/api/reports/bc-tong?month=${m}&year=${y}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
      updateTab(tabId, { data: await res.json() })
    } catch (e: any) { updateTab(tabId, { error: e.message }) }
    finally { updateTab(tabId, { loading: false }) }
  }, [updateTab])

  const refreshData = async () => {
    const id = activeTabId
    const t  = activeTab
    updateTab(id, { refreshing: true })
    await fetch(`/api/revalidate?tag=bc-tong`, { method: 'POST' }).catch(() => {})
    await fetchData(t.month, t.year, id)
    updateTab(id, { refreshing: false })
  }

  // Đồng bộ tabs → store mỗi khi thay đổi
  useEffect(() => { savePage('bc-tong', { tabs, activeTabId }) }, [tabs, activeTabId, savePage])

  // Fix nextId khi khôi phục từ store
  useEffect(() => {
    const maxId = Math.max(...tabs.map(t => Number(t.id)))
    if (maxId >= nextId.current) nextId.current = maxId + 1
  }, [])

  // Tải lần đầu — bỏ qua nếu tab đã có data (khôi phục từ store)
  useEffect(() => {
    const first = tabs[0]
    if (!first.data && !first.loading) fetchData(first.month, first.year, first.id)
  }, [])

  // Thêm tab mới
  const addTab = () => {
    const id = String(nextId.current++)
    const m  = now.getMonth() + 1
    const y  = now.getFullYear()
    const newTab: TabState = { id, month: m, year: y, data: null, loading: false, error: '', refreshing: false }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    fetchData(m, y, id)
  }

  // Đóng tab (không đóng tab cuối)
  const closeTab = (id: string) => {
    const next = tabs.filter(t => t.id !== id)
    if (next.length === 0) return
    setTabs(next)
    if (activeTabId === id) {
      const idx = tabs.findIndex(t => t.id === id)
      setActiveTabId(next[Math.min(idx, next.length - 1)].id)
    }
  }

  const tq = data?.tongQuan

  return (
    <div className="space-y-6">
      {/* ── TAB BAR ── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5 overflow-x-auto mb-1">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          const label = `T${tab.month}/${tab.year}`
          return (
            <div key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap
                ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
              onClick={() => setActiveTabId(tab.id)}>
              <span>{tab.loading ? '⏳' : '📊'} {label}</span>
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

      {/* Tiêu đề + bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo Cáo Tổng — Tuyển Dụng</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Thống kê UV đậu PV / đào tạo / ký HĐ / duyệt trong tháng
            {data && !data.empty && ` · Cập nhật: ${data.updatedAt}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select value={month} onChange={e => { const m = Number(e.target.value); updateTab(activeTabId, { month: m }); fetchData(m, activeTab.year, activeTabId) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={year} onChange={e => { const y = Number(e.target.value); updateTab(activeTabId, { year: y }); fetchData(activeTab.month, y, activeTabId) }}
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

      {/* Trạng thái */}
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">⚠️ {error}</div>
      )}
      {data?.empty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">📭 {data.message}</div>
      )}

      {/* Bảng 1 — Tổng quan 4 nhóm */}
      {tq && (
        <>
          <Section title="Bảng 1 — Tổng quan theo nhóm phễu">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {GROUPS.map(g => (
                <div key={g.key} className={`rounded-xl border p-4 ${COLOR[g.color].card}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${COLOR[g.color].badge}`}>{g.label}</p>
                  <p className="text-3xl font-bold text-slate-900">{tq[g.key as GroupKey]}</p>
                  <p className="text-xs text-slate-400 mt-1">UV trong tháng {month}/{year}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Bảng 2 — Chi tiết từng nhóm */}
          <Section title="Bảng 2 — Chi tiết theo nhóm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {GROUPS.map(g => {
                const grp = data[g.key as GroupKey] as GroupData | undefined
                if (!grp || grp.total === 0) return null
                return (
                  <GroupCard key={g.key} label={g.label} color={g.color} grp={grp} />
                )
              })}
            </div>
          </Section>

          {/* Bảng 3 — Tháng nhập UV tích lũy (byMonthNhap tất cả nhóm) */}
          <Section title="Bảng 3 — Tháng nhập UV (theo nhóm phễu)">
            <MonthTable data={data} />
          </Section>
        </>
      )}

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

// ── GroupCard ─────────────────────────────────────────────────────────
function GroupCard({ label, color, grp }: { label: string; color: string; grp: GroupData }) {
  const c     = COLOR[color]
  const topTT = grp.byTrangThai.slice(0, 8)
  const topKV = grp.byThiTruong.slice(0, 6)

  return (
    <div className={`rounded-xl border p-4 ${c.card}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-bold ${c.badge}`}>{label}</span>
        <span className={`text-xl font-bold ${c.badge}`}>{grp.total}</span>
      </div>

      {/* Top trạng thái */}
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

      {/* Top khu vực */}
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

// ── MonthTable — tháng nhập UV cross nhóm ────────────────────────────
function MonthTable({ data }: { data: BCTongData }) {
  // Gom tất cả tháng
  const monthSet = new Set<number>()
  GROUPS.forEach(g => {
    const grp = data[g.key as GroupKey] as GroupData | undefined
    grp?.byMonthNhap.forEach(r => monthSet.add(r.month))
  })
  const months = Array.from(monthSet).sort((a, b) => a - b)
  if (months.length === 0) return <p className="text-sm text-slate-400">Không có dữ liệu</p>

  // Lookup nhanh
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

// ── Section wrapper ───────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}