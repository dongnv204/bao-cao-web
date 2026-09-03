'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTabsStore } from '../tabs-store'
import { useMemo, useState as useLocalState } from 'react'
import ExportButtons from '@/components/ExportButtons'
import ComparePanel, { CompareRow } from '@/components/ComparePanel'
import { exportBCNgayExcel } from '@/lib/export-utils'

// ════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════
interface Bang1 {
  formNhapThang: number; targetFormThang: number
  uvLocThang?: number;  targetUvLocThang?: number
  uvNetThang: number;   targetUvNetThang: number
  hlNetThang: number;   targetHlNetThang: number
  trungNetThang: number; targetTrungThang: number
  tyLeHlThang: number | null
  chuaCheckThang: number
  hlThoThang?: number; trungThoThang?: number
  dauPVThang?: number; targetDauPVThang?: number
  kyHDThang?: number;  targetKyHDThang?: number
  duyetThang?: number; targetDuyetThang?: number
  // Ngày
  formNhapNgay?: number; targetFormNgay?: number
  uvLocNgay?: number;    uvNetNgay?: number; targetUvNetNgay?: number
  hlNetNgay?: number;    targetHlNetNgay?: number
  trungNetNgay?: number; targetTrungNgay?: number
  hlThoNgay?: number;    trungThoNgay?: number
}
interface Bang2Nguon {
  ten: string; uvNet: number; hlNet: number; trungNet: number
  tyLeHl: number | null; chuaCheck: number
}
interface PhanLoaiRow { phanLoai: string; soLuong: number; pct?: number | null }
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
  phanLoai?: PhanLoaiRow[]
}
interface Bang3Row {
  ngay: string; thu: string; formNhap: number; uvLoc: number
  pctHaoHut: number | null; uvNet: number; hlNet: number
  trungNet: number; chuaCheck: number; pctHl: number | null
  isSelected?: boolean; isTotal?: boolean
  hoaUvNet?: number; hoaHlNet?: number; hoaTrungNet?: number
  ngocUvNet?: number; ngocHlNet?: number; ngocTrungNet?: number
}
interface Bang4Day {
  ngay: string; thu: string; tho: number; loc: number; net: number
  pctHH: number | null; hlNet: number; trungNet: number; pctHl: number | null
}
interface Bang4Page { maTrang: string; tenTrang: string; days: Bang4Day[] }
interface ReportData {
  day: number; month: number; year: number
  bang1: Bang1; bang2: Bang2; bang3: Bang3Row[]; bang4: Bang4Page[]
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : v.toFixed(1) + '%'
const num = (v: number | null | undefined) => (v ?? 0).toLocaleString()

function progress(val: number, target: number) {
  if (!target) return null
  const pct = (val / target) * 100
  const diff = val - target
  return {
    pct: Math.min(pct, 100),
    pctStr: pct.toFixed(1) + '%',
    diff,
    diffStr: diff < 0 ? `Thiếu ${diff}` : `+${diff}`,
    isShort: diff < 0,
  }
}

// Compute Bảng 5 from bang4
function computeBang5(bang4: Bang4Page[]) {
  return bang4.map(page => {
    const tho = page.days.reduce((s, d) => s + (d.tho || 0), 0)
    const loc = page.days.reduce((s, d) => s + (d.loc || 0), 0)
    const net = page.days.reduce((s, d) => s + (d.net || 0), 0)
    const hl = page.days.reduce((s, d) => s + (d.hlNet || 0), 0)
    const tr = page.days.reduce((s, d) => s + (d.trungNet || 0), 0)
    const pctHL = (hl + tr) > 0 ? (hl / (hl + tr)) * 100 : null
    const pctHH = tho > 0 ? ((tho - net) / tho) * 100 : null
    return { ten: page.tenTrang, tho, loc, net, hl, tr, pctHL, pctHH }
  })
}

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
function Td({ children, right, bold, className = '' }: { children: React.ReactNode; right?: boolean; bold?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-2 text-sm whitespace-nowrap ${right ? 'text-right' : ''} ${bold ? 'font-semibold' : ''} ${className}`}>
      {children}
    </td>
  )
}

// Progress bar KPI — matching Google Sheet colored blocks
function KpiProgress({ label, val, target, bg, textVal }: {
  label: string; val: number; target: number
  bg: string; textVal?: string
}) {
  const p = progress(val, target)
  return (
    <div className={`${bg} rounded-lg p-3`}>
      <p className="text-white text-xs font-medium mb-1 opacity-90">{label}</p>
      <p className="text-white text-xl font-extrabold">
        {textVal ?? num(val)}
        <span className="text-white/60 text-sm font-normal"> / {num(target)}</span>
      </p>
      {p && (
        <>
          <div className="h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-white/80 rounded-full" style={{ width: p.pct + '%' }} />
          </div>
          <p className={`text-xs mt-1 ${p.isShort ? 'text-yellow-200' : 'text-green-200'}`}>
            {p.pctStr} — {p.diffStr}
          </p>
        </>
      )}
    </div>
  )
}

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
//  PAGE
// ════════════════════════════════════════════════════════════════

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

export default function TuyenDungPage() {
  const today    = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nextId   = useRef(2)
  const { getPage, savePage } = useTabsStore()

  // ── Tabs — khôi phục từ store nếu đã từng mở trang này ───────────────
  const [tabs, setTabs] = useState<TabState[]>(() => {
    const s = getPage('bc-ngay')
    if (s && s.tabs.length > 0) return s.tabs as TabState[]
    return [{ id: '1', date: todayStr, data: null, loading: false, error: '', refreshing: false }]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const s = getPage('bc-ngay')
    return s ? s.activeTabId : '1'
  })

  // Cập nhật fields của 1 tab theo id
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
      { label: 'Ký HĐ',       a: a.kyHDThang     ?? 0, b: b.kyHDThang     ?? 0 },
      { label: 'Duyệt',        a: a.duyetThang    ?? 0, b: b.duyetThang    ?? 0 },
    ]
  }, [tabs, compareA, compareB])

  // Alias — JSX bên dưới không cần sửa
  const activeTab       = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const selectedDate    = activeTab.date
  const setSelectedDate = (d: string) => updateTab(activeTabId, { date: d })
  const data            = activeTab.data
  const loading         = activeTab.loading
  const error           = activeTab.error
  const refreshing      = activeTab.refreshing

  const dateObj    = new Date(selectedDate + 'T00:00:00')
  const displayDate = dateObj.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  // Tải dữ liệu cho 1 tab cụ thể
  const loadData = useCallback(async (dateStr: string, tabId: string) => {
    updateTab(tabId, { loading: true, error: '' })
    try {
      const d = new Date(dateStr + 'T00:00:00')
      const res = await fetch(
        `/api/reports/tuyen-dung?day=${d.getDate()}&month=${d.getMonth()+1}&year=${d.getFullYear()}`
      )
      const json = await res.json()
      if (!res.ok) { updateTab(tabId, { data: null, error: json.error || 'Lỗi không xác định' }) }
      else updateTab(tabId, { data: json })
    } catch { updateTab(tabId, { data: null, error: 'Lỗi kết nối máy chủ' }) }
    finally { updateTab(tabId, { loading: false }) }
  }, [updateTab])

  // Đồng bộ tabs → store mỗi khi thay đổi
  useEffect(() => { savePage('bc-ngay', { tabs, activeTabId }) }, [tabs, activeTabId, savePage])

  // Fix nextId khi khôi phục từ store
  useEffect(() => {
    const maxId = Math.max(...tabs.map(t => Number(t.id)))
    if (maxId >= nextId.current) nextId.current = maxId + 1
  }, [])

  // Xoá cache server rồi tải lại dữ liệu mới nhất
  const refreshData = async () => {
    const id = activeTabId
    updateTab(id, { refreshing: true })
    await fetch(`/api/revalidate?tag=bc-ngay`, { method: 'POST' }).catch(() => {})
    await loadData(activeTab.date, id)
    updateTab(id, { refreshing: false })
  }

  // Thêm tab mới (mặc định ngày hôm nay)
  const addTab = () => {
    const id = String(nextId.current++)
    const newTab: TabState = { id, date: todayStr, data: null, loading: false, error: '', refreshing: false }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    loadData(todayStr, id)
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

  const b1  = data?.bang1
  const b2  = data?.bang2
  const b3  = data?.bang3 ?? []
  const b4  = data?.bang4 ?? []
  const b5  = computeBang5(b4)
  const mY  = data ? `${String(data.month).padStart(2,'0')}/${data.year}` : ''

  const bang3SelectedIdx = b3.findIndex(r => r.isSelected)
  const bang3Total = b3.find(r => r.isTotal)

  // Tổng Bảng 5
  const b5Total = b5.length > 0 ? {
    ten: 'Tổng',
    tho: b5.reduce((s,r)=>s+r.tho,0),
    loc: b5.reduce((s,r)=>s+r.loc,0),
    net: b5.reduce((s,r)=>s+r.net,0),
    hl:  b5.reduce((s,r)=>s+r.hl,0),
    tr:  b5.reduce((s,r)=>s+r.tr,0),
    pctHL: null as number|null,
    pctHH: null as number|null,
  } : null
  if (b5Total) {
    b5Total.pctHL = (b5Total.hl + b5Total.tr) > 0 ? b5Total.hl/(b5Total.hl+b5Total.tr)*100 : null
    b5Total.pctHH = b5Total.tho > 0 ? (b5Total.tho - b5Total.net)/b5Total.tho*100 : null
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── TAB BAR ── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5 overflow-x-auto">
        {tabs.map(tab => {
          const tabDate = new Date(tab.date + 'T00:00:00')
          const label   = tabDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
      <div className="bg-[#0d1b6b] text-white rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-wide">BÁO CÁO CHỈ SỐ TUYỂN DỤNG</h1>
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
            className="bg-white text-[#0d1b6b] text-sm font-bold px-4 py-2 rounded-lg
                       hover:bg-blue-50 transition disabled:opacity-50 flex items-center gap-2"
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
            title="Xoá cache và lấy dữ liệu mới nhất từ Google Sheets"
            className="bg-white/15 border border-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg
                       hover:bg-white/25 transition disabled:opacity-50"
          >
            {refreshing ? '...' : 'Làm mới'}
          </button>
        </div>
      </div>
      {/* Export buttons */}
      <div className="flex justify-end no-print">
        <ExportButtons
          disabled={!data || loading}
          onExcelClick={() => data && exportBCNgayExcel(data, selectedDate)}
        />
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorBox msg={error} />}

      {!loading && data && b1 && b2 && (
        <>
          {/* ══════════════════════════════════════════════
              BẢNG 1 — TIẾN ĐỘ KẾT QUẢ / MỤC TIÊU
          ══════════════════════════════════════════════ */}
          <section>
            <SectionTitle color="bg-[#0d1b6b]" text="BẢNG 1 — TIẾN ĐỘ KẾT QUẢ / MỤC TIÊU" />
            <div className="border border-slate-200 rounded-b-xl overflow-hidden bg-white shadow-sm">

              {/* Hàng THÁNG */}
              <div className="border-b border-slate-200">
                <div className="grid grid-cols-[90px_1fr] divide-x divide-slate-200">
                  <div className="bg-[#0d1b6b] text-white flex items-center justify-center p-3 text-xs font-bold text-center">
                    THÁNG<br/>{mY}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3">
                    <KpiProgress label="Tổng Form Nhập" val={b1.formNhapThang} target={b1.targetFormThang} bg="bg-[#e65100]" />
                    <KpiProgress label="Tổng UV Lọc"    val={b1.uvLocThang ?? b1.formNhapThang} target={b1.targetUvLocThang ?? b1.targetFormThang} bg="bg-[#212121]" />
                    <KpiProgress label="Tổng UV Net"    val={b1.uvNetThang}    target={b1.targetUvNetThang}  bg="bg-[#00695c]" />
                    <KpiProgress label="HL Net"         val={b1.hlNetThang}    target={b1.targetHlNetThang}  bg="bg-[#f9a825]" />
                    <KpiProgress label="Trùng Net"      val={b1.trungNetThang} target={b1.targetTrungThang}  bg="bg-[#4a148c]" />
                    <KpiSingle   label="Tỷ Lệ HL"       val={fmtPct(b1.tyLeHlThang)} sub="HL Net / (HL+Tr) Net" bg="bg-[#b71c1c]" big />
                  </div>
                </div>
              </div>

              {/* Hàng HIỆN TẠI */}
              <div className="border-b border-slate-200">
                <div className="grid grid-cols-[90px_1fr] divide-x divide-slate-200">
                  <div className="bg-slate-700 text-white flex items-center justify-center p-3 text-xs font-bold text-center">
                    HIỆN TẠI<br/>{`${String(data.day).padStart(2,'0')}/${mY}`}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3">
                    <KpiProgress label="Form Nhập"   val={b1.formNhapNgay ?? b2.tho.formNhap} target={b1.targetFormNgay ?? b2.tho.targetFormNgay} bg="bg-[#e65100]" />
                    <KpiProgress label="UV Lọc"      val={b1.uvLocNgay ?? b2.tho.uvLoc}       target={b1.targetFormNgay ?? b2.tho.targetFormNgay} bg="bg-[#212121]" />
                    <KpiProgress label="UV Net"      val={b1.uvNetNgay ?? b2.net.uvNet}        target={b1.targetUvNetNgay ?? b2.net.targetUvNetNgay} bg="bg-[#00695c]" />
                    <KpiProgress label="HL Net"      val={b1.hlNetNgay ?? b2.net.hlNet}        target={b1.targetHlNetNgay ?? b2.net.targetHlNetNgay}  bg="bg-[#f9a825]" />
                    <KpiProgress label="Trùng Net"   val={b1.trungNetNgay ?? b2.net.trungNet}  target={b1.targetTrungNgay ?? b2.net.targetTrungNgay}  bg="bg-[#4a148c]" />
                    <div className="grid grid-cols-2 gap-2">
                      <KpiSingle label="HL Thô"    val={b1.hlThoNgay ?? b2.tho.hlTho}    bg="bg-blue-700" />
                      <KpiSingle label="Trùng Thô" val={b1.trungThoNgay ?? b2.tho.trungTho} bg="bg-blue-900" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Hàng phụ: Chưa Check, Đậu PV, Ký HĐ, Duyệt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50">
                <KpiSingle label="Chưa Check" val={num(b1.chuaCheckThang)} sub="SĐT chưa xác thực" bg="bg-slate-600" />
                {b1.dauPVThang != null
                  ? <KpiProgress label="Đậu PV" val={b1.dauPVThang} target={b1.targetDauPVThang ?? 0} bg="bg-indigo-700" />
                  : <KpiSingle label="Đậu PV" val={num(b2.net.hlNet)} sub="UV HL có Đậu PV" bg="bg-indigo-700" />
                }
                {b1.kyHDThang != null
                  ? <KpiProgress label="Ký HĐ" val={b1.kyHDThang} target={b1.targetKyHDThang ?? 0} bg="bg-green-800" />
                  : <KpiSingle label="Ký HĐ" val="0" sub="/ mục tiêu" bg="bg-green-800" />
                }
                {b1.duyetThang != null
                  ? <KpiProgress label="Duyệt" val={b1.duyetThang} target={b1.targetDuyetThang ?? 0} bg="bg-green-700" />
                  : <KpiSingle label="Duyệt" val="0" sub="/ mục tiêu" bg="bg-green-700" />
                }
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              BẢNG 2 — NGÀY HIỆN TẠI
          ══════════════════════════════════════════════ */}
          <section>
            <SectionTitle color="bg-slate-700" text={`BẢNG 2 — NGÀY HIỆN TẠI ${String(data.day).padStart(2,'0')}/${mY}`} />
            <div className="border border-slate-200 rounded-b-xl bg-white shadow-sm overflow-hidden">

              {/* Thô + Net */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Thô */}
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Thô</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <KpiProgress label="Form Nhập" val={b2.tho.formNhap} target={b2.tho.targetFormNgay} bg="bg-[#e65100]" />
                    <KpiProgress label="UV Lọc"    val={b2.tho.uvLoc}    target={b2.tho.targetFormNgay} bg="bg-[#212121]" />
                    <KpiSingle   label="Chưa Check" val={num(b2.tho.chuaCheck ?? b1.chuaCheckThang)} sub="SĐT chưa xác thực" bg="bg-slate-500" />
                    <KpiSingle   label="HL Thô"    val={`${b2.tho.hlTho} (${fmtPct(b2.tho.pctHlTho)})`} sub="/ UV Lọc" bg="bg-green-700" />
                    <KpiSingle   label="Trùng Thô" val={`${b2.tho.trungTho} (${fmtPct(b2.tho.pctTrungTho)})`} sub="/ UV Lọc" bg="bg-red-700" />
                  </div>
                </div>
                {/* Net */}
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Net</p>
                  <div className="grid grid-cols-2 gap-3">
                    <KpiProgress label="Tổng UV Net" val={b2.net.uvNet}    target={b2.net.targetUvNetNgay} bg="bg-[#00695c]" />
                    <KpiSingle   label="Tỷ Lệ HL"    val={fmtPct(b2.net.tyLeHl)} sub="HL Net / (HL+Trùng) Net" bg="bg-[#b71c1c]" big />
                    <KpiProgress label="HL Net"      val={b2.net.hlNet}    target={b2.net.targetHlNetNgay} bg="bg-[#f9a825]" />
                    <KpiProgress label="Trùng Net"   val={b2.net.trungNet} target={b2.net.targetTrungNgay} bg="bg-[#4a148c]" />
                  </div>
                </div>
              </div>

              {/* Nguồn */}
              {b2.nguon.length > 0 && (
                <div className="border-t border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nguồn</p>
                  <div className="overflow-x-auto" style={{ maxWidth: '50%' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          <Th>Nguồn</Th>
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

              {/* Phân loại */}
              {b2.phanLoai && b2.phanLoai.length > 0 && (
                <div className="border-t border-slate-200 p-4">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">
                    📌 Phân Loại (UV Hợp Lệ Net — tổng: {b2.net.hlNet})
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-amber-50 text-amber-800">
                          <Th>Phân Loại</Th>
                          <Th right>Số UV</Th>
                          <Th right>% / HL Net</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {b2.phanLoai.map((pl, i) => (
                          <tr key={i} className="hover:bg-amber-50/50">
                            <Td>{pl.phanLoai}</Td>
                            <Td right bold>{num(pl.soLuong)}</Td>
                            <Td right className="text-amber-700">{fmtPct(pl.pct)}</Td>
                          </tr>
                        ))}
                        <tr className="bg-amber-100 font-bold">
                          <Td bold>TỔNG HL NET</Td>
                          <Td right bold>{num(b2.net.hlNet)}</Td>
                          <Td right bold>100%</Td>
                        </tr>
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
                      {b3[0]?.hoaHlNet != null && <>
                        <Th right>C.Hoa Net</Th>
                        <Th right>C.Hoa HL</Th>
                        <Th right>C.Hoa Tr</Th>
                        <Th right>C.Ngọc Net</Th>
                        <Th right>C.Ngọc HL</Th>
                        <Th right>C.Ngọc Tr</Th>
                      </>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {b3.filter(r => !r.isTotal).map((r, i) => (
                      <tr key={i} className={`
                        ${r.isSelected ? 'bg-yellow-50 font-semibold' : 'hover:bg-slate-50'}
                      `}>
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
                        {r.hoaHlNet != null && <>
                          <Td right>{num(r.hoaUvNet)}</Td>
                          <Td right className="text-green-700">{num(r.hoaHlNet)}</Td>
                          <Td right className="text-purple-700">{num(r.hoaTrungNet)}</Td>
                          <Td right>{num(r.ngocUvNet)}</Td>
                          <Td right className="text-green-700">{num(r.ngocHlNet)}</Td>
                          <Td right className="text-purple-700">{num(r.ngocTrungNet)}</Td>
                        </>}
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
                        {bang3Total.hoaHlNet != null && <>
                          <Td right>{num(bang3Total.hoaUvNet)}</Td>
                          <Td right className="text-yellow-300">{num(bang3Total.hoaHlNet)}</Td>
                          <Td right>{num(bang3Total.hoaTrungNet)}</Td>
                          <Td right>{num(bang3Total.ngocUvNet)}</Td>
                          <Td right className="text-yellow-300">{num(bang3Total.ngocHlNet)}</Td>
                          <Td right>{num(bang3Total.ngocTrungNet)}</Td>
                        </>}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              BẢNG 5 — THỐNG KÊ UV THEO NGUỒN (TỔNG THÁNG)
          ══════════════════════════════════════════════ */}
          {b5.length > 0 && b5Total && (
            <section>
              <SectionTitle color="bg-teal-800" text={`BẢNG 5 — THỐNG KÊ UV THEO NGUỒN — Tháng ${mY}`} />
              <div className="border border-slate-200 rounded-b-xl bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-teal-900 text-xs">
                        <Th>Chỉ Số</Th>
                        {b5.map((r, i) => {
                          const HC = ['#60a5fa','#34d399','#fbbf24','#c084fc','#f87171','#a78bfa']
                          return <Th key={i} right><span style={{ color: HC[i % HC.length] }}>{r.ten}</span></Th>
                        })}
                        <Th right><span style={{ color: '#fcd34d' }}>Tổng</span></Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { label: 'Thô (Form Nhập)', key: 'tho', color: 'text-orange-600' },
                        { label: 'Lọc (UV Lọc)',    key: 'loc', color: '' },
                        { label: 'Net (UV Net)',     key: 'net', color: 'text-teal-700' },
                        { label: 'HL Net',           key: 'hl',  color: 'text-green-700 font-semibold' },
                        { label: 'Trùng Net',        key: 'tr',  color: 'text-purple-700 font-semibold' },
                      ].map(row => (
                        <tr key={row.key} className="hover:bg-teal-50">
                          <Td bold>{row.label}</Td>
                          {b5.map((r, i) => (
                            <Td key={i} right className={row.color}>
                              {num((r as any)[row.key])}
                            </Td>
                          ))}
                          <Td right bold className={row.color}>
                            {num((b5Total as any)[row.key])}
                          </Td>
                        </tr>
                      ))}
                      <tr className="bg-orange-50 hover:bg-orange-100">
                        <Td bold className="text-orange-700">% HL</Td>
                        {b5.map((r, i) => (
                          <Td key={i} right className="text-orange-600 font-bold">{fmtPct(r.pctHL)}</Td>
                        ))}
                        <Td right bold className="text-orange-600">{fmtPct(b5Total.pctHL)}</Td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <Td bold className="text-slate-500">% Hao Hụt</Td>
                        {b5.map((r, i) => (
                          <Td key={i} right className="text-slate-500">{fmtPct(r.pctHH)}</Td>
                        ))}
                        <Td right bold className="text-slate-600">{fmtPct(b5Total.pctHH)}</Td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
          {/* ══════════════════════════════════════════════
              BẢNG 4 — PHÂN BỔ UV THEO MÃ TRANG
          ══════════════════════════════════════════════ */}
          {b4.length > 0 && (
            <section>
              <SectionTitle color="bg-indigo-800" text={`BẢNG 4 — PHÂN BỔ UV THEO NGUỒN / MÃ TRANG (${mY})`} />
              <div className="border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white">
                  {b4.map(page => {
                    const tot = {
                      tho: page.days.reduce((s,d)=>s+d.tho,0),
                      loc: page.days.reduce((s,d)=>s+d.loc,0),
                      net: page.days.reduce((s,d)=>s+d.net,0),
                      hl:  page.days.reduce((s,d)=>s+d.hlNet,0),
                      tr:  page.days.reduce((s,d)=>s+d.trungNet,0),
                    }
                    const totPctHL = (tot.hl+tot.tr)>0 ? tot.hl/(tot.hl+tot.tr)*100 : null
                    const totPctHH = tot.tho > 0 ? (tot.tho-tot.net)/tot.tho*100 : null
                    return (
                      <div key={page.maTrang} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-blue-700 text-white text-sm font-bold px-4 py-2.5 flex items-center gap-2">
                          📊 {page.tenTrang}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-blue-900 text-blue-100">
                                <Th>Ngày</Th>
                                <Th>Thứ</Th>
                                <Th right>Thô</Th>
                                <Th right>Lọc</Th>
                                <Th right>Net</Th>
                                <Th right>%HH</Th>
                                <Th right>HL Net</Th>
                                <Th right>Trùng</Th>
                                <Th right>%HL</Th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {page.days.map((d, i) => (
                                <tr key={i} className="hover:bg-blue-50">
                                  <Td>{d.ngay}</Td>
                                  <Td>{d.thu}</Td>
                                  <Td right>{num(d.tho)}</Td>
                                  <Td right>{num(d.loc)}</Td>
                                  <Td right>{num(d.net)}</Td>
                                  <Td right className="text-slate-400">{fmtPct(d.pctHH)}</Td>
                                  <Td right className="text-green-700 font-semibold">{num(d.hlNet)}</Td>
                                  <Td right className="text-purple-700 font-semibold">{num(d.trungNet)}</Td>
                                  <Td right className="text-orange-600">{fmtPct(d.pctHl)}</Td>
                                </tr>
                              ))}
                              <tr className="bg-blue-900 text-white font-bold text-xs">
                                <Td bold className="text-white" >TỔNG</Td>
                                <Td>—</Td>
                                <Td right>{num(tot.tho)}</Td>
                                <Td right>{num(tot.loc)}</Td>
                                <Td right>{num(tot.net)}</Td>
                                <Td right className="text-blue-200">{fmtPct(totPctHH)}</Td>
                                <Td right className="text-yellow-300">{num(tot.hl)}</Td>
                                <Td right className="text-purple-300">{num(tot.tr)}</Td>
                                <Td right className="text-yellow-300">{fmtPct(totPctHL)}</Td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

        </>
      )}
      {compareOpen && (
        <ComparePanel
          tabs={tabs.map(t => ({
            id: t.id,
            label: new Date(t.date + 'T00:00:00').toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }),
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