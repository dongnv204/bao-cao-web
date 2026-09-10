'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTabsStore } from '../../tabs-store'
import { useMemo, useState as useLocalState } from 'react'
import { cacheGet, cacheSet, cacheClear } from '@/lib/cache'
import { DailyTrendChart } from '@/components/charts/RecruitChart'
import ComparePanel, { CompareRow } from '@/components/ComparePanel'

// ════════════════════════════════════════════════════════════════
//  TYPES — giống BC Ngày nhưng không có bang4
// ════════════════════════════════════════════════════════════════
interface Bang1 {
  formNhapThang: number; targetFormThang: number
  uvLocThang?: number;  targetUvLocThang?: number
  uvNetThang: number;   targetUvNetThang: number
  hlNetThang: number;   targetHlNetThang: number
  trungNetThang: number; targetTrungThang: number
  tyLeHlThang: number | null
  chuaCheckThang: number
  hlThoNgay?: number;   trungThoNgay?: number
  formNhapNgay?: number; targetFormNgay?: number
  uvLocNgay?: number;   uvNetNgay?: number; targetUvNetNgay?: number
  hlNetNgay?: number;   targetHlNetNgay?: number
  trungNetNgay?: number; targetTrungNgay?: number
}
interface Bang2Nguon {
  ten: string; uvNet: number; hlNet: number; trungNet: number
  tyLeHl: number | null; chuaCheck: number
}
interface Bang2 {
  tho: {
    formNhap: number; targetFormNgay: number; uvLoc: number
    hlTho: number; pctHlTho: number | null
    trungTho: number; pctTrungTho: number | null; chuaCheck?: number
  }
  net: {
    uvNet: number; targetUvNetNgay: number
    hlNet: number; targetHlNetNgay: number
    trungNet: number; targetTrungNgay: number; tyLeHl: number | null
  }
  nguon: Bang2Nguon[]
}
interface Bang3Row {
  ngay: string; thu: string; formNhap: number; uvLoc: number
  pctHaoHut: number | null; uvNet: number; hlNet: number
  trungNet: number; chuaCheck: number; pctHl: number | null
  isSelected?: boolean; isTotal?: boolean
}
interface ReportData {
  day: number; month: number; year: number
  bang1: Bang1; bang2: Bang2; bang3: Bang3Row[]
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : v.toFixed(1) + '%'
const num = (v: number | null | undefined) => (v ?? 0).toLocaleString()

// ════════════════════════════════════════════════════════════════
//  SMALL UI COMPONENTS
// ════════════════════════════════════════════════════════════════
function SectionTitle({ color, text }: { color: string; text: string }) {
  return (
    <div className={`${color} text-white font-bold text-sm px-4 py-2 rounded-t-xl flex items-center gap-2`}>
      {text}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
function Td({ children, right, bold, className = '' }: {
  children: React.ReactNode; right?: boolean; bold?: boolean; className?: string
}) {
  return (
    <td className={`px-3 py-2 text-sm whitespace-nowrap ${right ? 'text-right' : ''} ${bold ? 'font-semibold' : ''} ${className}`}>
      {children}
    </td>
  )
}

// KPI không có mục tiêu — dùng cho BC Test (không có targets từ Supabase)
function KpiSingle({ label, val, sub, bg, big }: {
  label: string; val: string | number; sub?: string; bg: string; big?: boolean
}) {
  return (
    <div className={`${bg} rounded-lg p-3 text-center`}>
      <p className="text-white text-xs font-medium mb-1 opacity-90">{label}</p>
      <p className={`text-white font-extrabold ${big ? 'text-2xl' : 'text-xl'}`}>{val}</p>
      {sub && <p className="text-white/70 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  LOADING / ERROR STATES
// ════════════════════════════════════════════════════════════════
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p className="text-slate-500 text-sm">Đang tải dữ liệu...</p>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
      <span className="text-amber-500 text-lg">⚠️</span>
      <div>
        <p className="text-amber-800 font-medium text-sm">Không tải được dữ liệu</p>
        <p className="text-amber-700/80 text-xs mt-1">{msg}</p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  MULTI-TAB STATE
// ════════════════════════════════════════════════════════════════
interface TabState {
  id: string
  date: string
  data: ReportData | null
  loading: boolean
  error: string
  refreshing: boolean
}

export default function BcTestPage() {
  const today    = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nextId   = useRef(2)
  const { getPage, savePage } = useTabsStore()

  // Khôi phục tabs từ store
  const [tabs, setTabs] = useState<TabState[]>(() => {
    const s = getPage('bc-test')
    if (s && s.tabs.length > 0) return s.tabs as TabState[]
    return [{ id: '1', date: todayStr, data: null, loading: false, error: '', refreshing: false }]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const s = getPage('bc-test')
    return s ? s.activeTabId : '1'
  })

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  // So sánh 2 tab
  const [compareOpen, setCompareOpen] = useLocalState(false)
  const [compareA, setCompareA]       = useLocalState(() => tabs[0]?.id ?? '1')
  const [compareB, setCompareB]       = useLocalState(() => tabs[1]?.id ?? '1')

  const compareRows = useMemo((): CompareRow[] => {
    const dA = tabs.find(t => t.id === compareA)?.data
    const dB = tabs.find(t => t.id === compareB)?.data
    if (!dA?.bang1 || !dB?.bang1) return []
    const a = dA.bang1, b = dB.bang1
    return [
      { label: 'Dữ liệu ngày', a: null, b: null, isSeparator: true },
      { label: 'Form Nhập',    a: a.formNhapNgay  ?? 0, b: b.formNhapNgay  ?? 0 },
      { label: 'UV Net',       a: a.uvNetNgay     ?? 0, b: b.uvNetNgay     ?? 0 },
      { label: 'HL Net',       a: a.hlNetNgay     ?? 0, b: b.hlNetNgay     ?? 0 },
      { label: 'Trung Net',    a: a.trungNetNgay  ?? 0, b: b.trungNetNgay  ?? 0 },
      { label: 'Lũy kế tháng', a: null, b: null, isSeparator: true },
      { label: 'Form Nhập',    a: a.formNhapThang ?? 0, b: b.formNhapThang ?? 0 },
      { label: 'UV Net',       a: a.uvNetThang    ?? 0, b: b.uvNetThang    ?? 0 },
      { label: 'HL Net',       a: a.hlNetThang    ?? 0, b: b.hlNetThang    ?? 0 },
      { label: 'Trung Net',    a: a.trungNetThang ?? 0, b: b.trungNetThang ?? 0 },
    ]
  }, [tabs, compareA, compareB])

  const activeTab       = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const selectedDate    = activeTab.date
  const setSelectedDate = (d: string) => updateTab(activeTabId, { date: d })
  const data            = activeTab.data
  const loading         = activeTab.loading
  const error           = activeTab.error
  const refreshing      = activeTab.refreshing

  const dateObj     = new Date(selectedDate + 'T00:00:00')
  const displayDate = dateObj.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  // Tải dữ liệu — gọi /api/reports/bc-test
  const loadData = useCallback(async (dateStr: string, tabId: string, skipCache = false) => {
    updateTab(tabId, { loading: true, error: '' })
    try {
      if (!skipCache) {
        const cached = cacheGet<ReportData>(`bc-test:${dateStr}`)
        if (cached) { updateTab(tabId, { data: cached }); return }
      }
      const d = new Date(dateStr + 'T00:00:00')
      const res = await fetch(
        `/api/reports/bc-test?day=${d.getDate()}&month=${d.getMonth() + 1}&year=${d.getFullYear()}`
      )
      const json = await res.json()
      if (!res.ok) { updateTab(tabId, { data: null, error: json.error || 'Lỗi không xác định' }) }
      else { cacheSet(`bc-test:${dateStr}`, json); updateTab(tabId, { data: json }) }
    } catch { updateTab(tabId, { data: null, error: 'Lỗi kết nối máy chủ' }) }
    finally { updateTab(tabId, { loading: false }) }
  }, [updateTab])

  // Đồng bộ tabs → store
  useEffect(() => { savePage('bc-test', { tabs, activeTabId }) }, [tabs, activeTabId, savePage])

  useEffect(() => {
    const maxId = Math.max(...tabs.map(t => Number(t.id)))
    if (maxId >= nextId.current) nextId.current = maxId + 1
  }, [])

  // Tải lần đầu
  useEffect(() => {
    const first = tabs[0]
    if (!first.data && !first.loading) loadData(first.date, first.id)
  }, []) // eslint-disable-line

  // Xoá cache và tải lại từ Supabase
  const refreshData = async () => {
    const id = activeTabId
    updateTab(id, { refreshing: true })
    cacheClear(`bc-test:${activeTab.date}`)
    await loadData(activeTab.date, id, true)
    updateTab(id, { refreshing: false })
  }

  // Deep link — đọc ?date= từ URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const dt = p.get('date')
    if (dt && /^\d{4}-\d{2}-\d{2}$/.test(dt)) {
      updateTab(activeTabId, { date: dt })
      loadData(dt, activeTabId)
    }
  }, [])

  useEffect(() => {
    const u = new URLSearchParams()
    u.set('date', selectedDate)
    window.history.replaceState(null, '', '?' + u.toString())
  }, [selectedDate])

  const addTab = () => {
    const id = String(nextId.current++)
    const newTab: TabState = { id, date: todayStr, data: null, loading: false, error: '', refreshing: false }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    loadData(todayStr, id)
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

  const b1 = data?.bang1
  const b2 = data?.bang2
  const b3 = data?.bang3 ?? []
  const mY = data ? `${String(data.month).padStart(2, '0')}/${data.year}` : ''

  const bang3Total = b3.find(r => r.isTotal)

  return (
    <div className="space-y-6 pb-10">

      {/* ── TAB BAR ── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5 overflow-x-auto">
        {tabs.map(tab => {
          const tabDate  = new Date(tab.date + 'T00:00:00')
          const label    = tabDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const isActive = tab.id === activeTabId
          return (
            <div key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap
                ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
              onClick={() => setActiveTabId(tab.id)}>
              <span>{tab.loading ? '⏳' : '📅'} {label}</span>
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

      {/* ── HEADER ── */}
      <div className="bg-[#0d4a2b] text-white rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-wide">BC TEST — DỮ LIỆU SUPABASE</h1>
          <p className="text-white/70 text-xs mt-0.5 capitalize">{displayDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-2
                       outline-none focus:border-white/50 transition [color-scheme:dark]"
          />
          <button
            onClick={() => loadData(selectedDate, activeTabId)} disabled={loading}
            className="bg-white text-[#0d4a2b] text-sm font-bold px-4 py-2 rounded-lg
                       hover:bg-green-50 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading
              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              : '🔄'
            }
            Tải dữ liệu
          </button>
          <button
            onClick={refreshData} disabled={loading || refreshing}
            title="Xoá cache và lấy dữ liệu mới nhất từ Supabase"
            className="bg-white/15 border border-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg
                       hover:bg-white/25 transition disabled:opacity-50"
          >
            {refreshing ? '...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorBox msg={error} />}

      {!loading && data && b1 && b2 && (
        <>
          {/* ══════════════════════════════════════════════
              BẢNG 1 — KẾT QUẢ THÁNG VÀ NGÀY HIỆN TẠI
          ══════════════════════════════════════════════ */}
          <section>
            <SectionTitle color="bg-[#0d4a2b]" text="BẢNG 1 — KẾT QUẢ THÁNG VÀ NGÀY HIỆN TẠI" />
            <div className="border border-slate-200 rounded-b-xl overflow-hidden bg-white shadow-sm">

              {/* Hàng THÁNG */}
              <div className="border-b border-slate-200">
                <div className="grid grid-cols-[90px_1fr] divide-x divide-slate-200">
                  <div className="bg-[#0d4a2b] text-white flex items-center justify-center p-3 text-xs font-bold text-center">
                    THÁNG<br/>{mY}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3">
                    <KpiSingle label="Tổng Form Nhập" val={num(b1.formNhapThang)}   bg="bg-[#e65100]" />
                    <KpiSingle label="Tổng UV Lọc"    val={num(b1.uvLocThang ?? b1.formNhapThang)} bg="bg-[#212121]" />
                    <KpiSingle label="Tổng UV Net"    val={num(b1.uvNetThang)}       bg="bg-[#00695c]" />
                    <KpiSingle label="HL Net"          val={num(b1.hlNetThang)}       bg="bg-[#f9a825]" />
                    <KpiSingle label="Trùng Net"       val={num(b1.trungNetThang)}    bg="bg-[#4a148c]" />
                    <KpiSingle label="Tỷ Lệ HL"        val={fmtPct(b1.tyLeHlThang)} sub="HL Net / (HL+Tr) Net" bg="bg-[#b71c1c]" big />
                  </div>
                </div>
              </div>

              {/* Hàng HIỆN TẠI */}
              <div className="border-b border-slate-200">
                <div className="grid grid-cols-[90px_1fr] divide-x divide-slate-200">
                  <div className="bg-slate-700 text-white flex items-center justify-center p-3 text-xs font-bold text-center">
                    HIỆN TẠI<br/>{`${String(data.day).padStart(2, '0')}/${mY}`}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3">
                    <KpiSingle label="Form Nhập"  val={num(b1.formNhapNgay ?? b2.tho.formNhap)} bg="bg-[#e65100]" />
                    <KpiSingle label="UV Lọc"     val={num(b1.uvLocNgay ?? b2.tho.uvLoc)}       bg="bg-[#212121]" />
                    <KpiSingle label="UV Net"     val={num(b1.uvNetNgay ?? b2.net.uvNet)}        bg="bg-[#00695c]" />
                    <KpiSingle label="HL Net"     val={num(b1.hlNetNgay ?? b2.net.hlNet)}        bg="bg-[#f9a825]" />
                    <KpiSingle label="Trùng Net"  val={num(b1.trungNetNgay ?? b2.net.trungNet)}  bg="bg-[#4a148c]" />
                    <div className="grid grid-cols-2 gap-2">
                      <KpiSingle label="HL Thô"    val={b1.hlThoNgay ?? b2.tho.hlTho}    bg="bg-blue-700" />
                      <KpiSingle label="Trùng Thô" val={b1.trungThoNgay ?? b2.tho.trungTho} bg="bg-blue-900" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Hàng phụ: Chưa Check */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50">
                <KpiSingle label="Chưa Check" val={num(b1.chuaCheckThang)} sub="SĐT chưa xác thực" bg="bg-slate-600" />
                <KpiSingle label="Tỷ Lệ HL (ngày)" val={fmtPct(b2.net.tyLeHl)} sub="HL / (HL+Trùng) Net" bg="bg-indigo-700" big />
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              BẢNG 2 — NGÀY HIỆN TẠI
          ══════════════════════════════════════════════ */}
          <section>
            <SectionTitle color="bg-slate-700" text={`BẢNG 2 — NGÀY HIỆN TẠI ${String(data.day).padStart(2, '0')}/${mY}`} />
            <div className="border border-slate-200 rounded-b-xl bg-white shadow-sm overflow-hidden">

              {/* Thô + Net */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Thô */}
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Thô</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <KpiSingle label="Form Nhập"  val={num(b2.tho.formNhap)} bg="bg-[#e65100]" />
                    <KpiSingle label="UV Lọc"     val={num(b2.tho.uvLoc)}    bg="bg-[#212121]" />
                    <KpiSingle label="Chưa Check" val={num(b2.tho.chuaCheck ?? 0)} sub="SĐT chưa xác thực" bg="bg-slate-500" />
                    <KpiSingle label="HL Thô"    val={`${b2.tho.hlTho} (${fmtPct(b2.tho.pctHlTho)})`}     sub="/ UV Lọc" bg="bg-green-700" />
                    <KpiSingle label="Trùng Thô" val={`${b2.tho.trungTho} (${fmtPct(b2.tho.pctTrungTho)})`} sub="/ UV Lọc" bg="bg-red-700" />
                  </div>
                </div>
                {/* Net */}
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Net</p>
                  <div className="grid grid-cols-2 gap-3">
                    <KpiSingle label="Tổng UV Net" val={num(b2.net.uvNet)}       bg="bg-[#00695c]" />
                    <KpiSingle label="Tỷ Lệ HL"    val={fmtPct(b2.net.tyLeHl)} sub="HL Net / (HL+Trùng) Net" bg="bg-[#b71c1c]" big />
                    <KpiSingle label="HL Net"      val={num(b2.net.hlNet)}       bg="bg-[#f9a825]" />
                    <KpiSingle label="Trùng Net"   val={num(b2.net.trungNet)}    bg="bg-[#4a148c]" />
                  </div>
                </div>
              </div>

              {/* Theo Recruiter (thay vì Nguồn) */}
              {b2.nguon.length > 0 && (
                <div className="border-t border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Recruiter</p>
                  <div className="overflow-x-auto" style={{ maxWidth: '50%' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          <Th>Recruiter</Th>
                          <Th right>UV Net</Th>
                          <Th right>HL Net</Th>
                          <Th right>Trùng Net</Th>
                          <Th right>% HL</Th>
                          <Th right>Chưa Check</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {b2.nguon.map((ng, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <Td bold>{ng.ten}</Td>
                            <Td right>{num(ng.uvNet)}</Td>
                            <Td right className="text-green-700 font-semibold">{num(ng.hlNet)}</Td>
                            <Td right className="text-purple-700 font-semibold">{num(ng.trungNet)}</Td>
                            <Td right className="text-orange-600 font-semibold">{fmtPct(ng.tyLeHl)}</Td>
                            <Td right className="text-slate-500">{num(ng.chuaCheck)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              BẢNG 3 — CHỈ SỐ UV CÁC NGÀY TRONG THÁNG
          ══════════════════════════════════════════════ */}
          <section>
            <SectionTitle color="bg-blue-800" text={`BẢNG 3 — CHỈ SỐ UV CÁC NGÀY TRONG THÁNG ${mY}`} />
            <div className="border border-slate-200 rounded-b-xl bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto" style={{ maxWidth: '50%' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white text-xs">
                      <Th>Ngày</Th>
                      <Th>Thứ</Th>
                      <Th right>Form Nhập</Th>
                      <Th right>UV Lọc</Th>
                      <Th right>% Hao Hụt</Th>
                      <Th right>UV Net</Th>
                      <Th right>HL Net</Th>
                      <Th right>Trùng Net</Th>
                      <Th right>Chưa Check</Th>
                      <Th right>%(HL/HL+Tr)</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {b3.filter(r => !r.isTotal).map((r, i) => (
                      <tr key={i} className={r.isSelected ? 'bg-yellow-50 font-semibold' : 'hover:bg-slate-50'}>
                        <Td bold={r.isSelected}>{r.ngay}</Td>
                        <Td>{r.thu}</Td>
                        <Td right>{num(r.formNhap)}</Td>
                        <Td right>{num(r.uvLoc)}</Td>
                        <Td right className="text-slate-500">{fmtPct(r.pctHaoHut)}</Td>
                        <Td right>{num(r.uvNet)}</Td>
                        <Td right className={r.hlNet > 0 ? 'text-green-700 font-semibold' : ''}>{num(r.hlNet)}</Td>
                        <Td right className={r.trungNet > 0 ? 'text-purple-700 font-semibold' : ''}>{num(r.trungNet)}</Td>
                        <Td right className="text-slate-500">{num(r.chuaCheck)}</Td>
                        <Td right className="text-orange-600">{fmtPct(r.pctHl)}</Td>
                      </tr>
                    ))}
                    {/* Dòng tổng */}
                    {bang3Total && (
                      <tr className="bg-slate-800 text-white font-bold">
                        <Td bold>Tổng tháng</Td>
                        <Td>—</Td>
                        <Td right>{num(bang3Total.formNhap)}</Td>
                        <Td right>{num(bang3Total.uvLoc)}</Td>
                        <Td right>{fmtPct(bang3Total.pctHaoHut)}</Td>
                        <Td right>{num(bang3Total.uvNet)}</Td>
                        <Td right className="text-yellow-300">{num(bang3Total.hlNet)}</Td>
                        <Td right className="text-purple-300">{num(bang3Total.trungNet)}</Td>
                        <Td right>{num(bang3Total.chuaCheck)}</Td>
                        <Td right className="text-yellow-300">{fmtPct(bang3Total.pctHl)}</Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* DailyTrendChart — biểu đồ xu hướng theo ngày */}
          {b3.filter(r => !r.isTotal).length > 1 && (
            <section className="mt-2">
              <DailyTrendChart data={b3.filter(r => !r.isTotal).map(r => ({
                ngay: String(r.ngay),
                uvNet: r.uvNet,
                hlNet: r.hlNet,
                trungNet: r.trungNet,
              }))} />
            </section>
          )}
        </>
      )}

      {compareOpen && (
        <ComparePanel
          tabs={tabs.map(t => ({
            id: t.id,
            label: new Date(t.date + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            hasData: !!t.data
          }))}
          tabAId={compareA} tabBId={compareB}
          onTabAChange={setCompareA} onTabBChange={setCompareB}
          rows={compareRows}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  )
}
