'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────
interface Stats {
  month: number; year: number
  formNhap: number; hopLe: number; trung: number; chuaCheck: number; uvNet: number
  tyLeHl: number | null
  byRecruiter: { recruiter: string; formNhap: number; hopLe: number; trung: number; uvNet: number }[]
  dailyNet: { ngay: string; count: number }[]
}

interface Candidate {
  id: number; ngay_nhap: string; ten_uv: string; sdt: string
  check_sdt: string; phan_loai: string; trang_thai: string
  ghi_chu: string; recruiter: string
}

// ── Helpers ────────────────────────────────────────────────────────
const fmtPct = (v: number | null | undefined) => v == null ? '—' : v.toFixed(1) + '%'
const num    = (v: number) => (v ?? 0).toLocaleString()

function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`${color} rounded-xl p-4 text-white`}>
      <p className="text-xs font-medium opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-extrabold">{typeof value === 'number' ? num(value) : value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

function checkBadge(v: string) {
  const s = (v || '').toLowerCase()
  if (s.includes('trùng'))   return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Trùng</span>
  if (s.includes('hợp lệ'))  return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Hợp lệ</span>
  if (s === '')               return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">Chưa check</span>
  return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">{v}</span>
}

// ── Sparkline SVG đơn giản ─────────────────────────────────────────
function Sparkline({ data }: { data: { ngay: string; count: number }[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 320, H = 60, PAD = 4
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - (d.count / max) * (H - PAD * 2)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
      <polyline
        points={`${PAD},${H} ${pts.join(' ')} ${W - PAD},${H}`}
        fill="#3b82f6" fillOpacity="0.12" stroke="none"
      />
    </svg>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────
export default function BCTestPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // List
  const [listData, setListData] = useState<Candidate[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [loadingList, setLoadingList] = useState(false)

  // Search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Candidate[] | null>(null)
  const [loadingSearch, setLoadingSearch] = useState(false)

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/reports/bc-test?action=stats&month=${month}&year=${year}`)
      const json = await res.json()
      if (json.ok) setStats(json.data)
    } finally { setLoadingStats(false) }
  }, [month, year])

  // Fetch list
  const fetchList = useCallback(async (pg = 1) => {
    setLoadingList(true)
    try {
      const rec = recruiterFilter ? `&recruiter=${encodeURIComponent(recruiterFilter)}` : ''
      const res = await fetch(`/api/reports/bc-test?action=list&month=${month}&year=${year}&page=${pg}${rec}`)
      const json = await res.json()
      if (json.ok) {
        setListData(json.data)
        setListTotal(json.total)
        setTotalPages(json.totalPages)
        setListPage(pg)
      }
    } finally { setLoadingList(false) }
  }, [month, year, recruiterFilter])

  useEffect(() => { fetchStats(); fetchList(1) }, [fetchStats, fetchList])

  // Search
  const handleSearch = async () => {
    if (!query.trim()) { setSearchResults(null); return }
    setLoadingSearch(true)
    try {
      const res = await fetch(`/api/reports/bc-test?action=search&q=${encodeURIComponent(query.trim())}`)
      const json = await res.json()
      if (json.ok) setSearchResults(json.data)
    } finally { setLoadingSearch(false) }
  }

  const recruiters = stats?.byRecruiter.map(r => r.recruiter) ?? []

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="bg-[#0d1b6b] text-white rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-wide flex items-center gap-2">
            🧪 BC TEST — DỮ LIỆU SUPABASE
          </h1>
          <p className="text-white/60 text-xs mt-0.5">Đọc trực tiếp từ Supabase · Tháng {String(month).padStart(2,'0')}/{year}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-2 outline-none">
            {Array.from({length:12},(_,i)=>i+1).map(m => (
              <option key={m} value={m} className="text-slate-900">Tháng {m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-2 outline-none">
            {[2025,2026,2027].map(y => (
              <option key={y} value={y} className="text-slate-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats tiles */}
      {loadingStats && <p className="text-slate-400 text-sm text-center py-4">Đang tải thống kê...</p>}
      {stats && !loadingStats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile label="Form Nhập"   value={stats.formNhap}  color="bg-[#e65100]" />
            <StatTile label="Hợp Lệ"      value={stats.hopLe}     color="bg-[#00695c]" />
            <StatTile label="Trùng"        value={stats.trung}     color="bg-[#4a148c]" />
            <StatTile label="Chưa Check"  value={stats.chuaCheck} color="bg-slate-600" />
            <StatTile label="UV Net"       value={stats.uvNet}     color="bg-[#0d1b6b]" />
            <StatTile label="% Hợp Lệ"   value={fmtPct(stats.tyLeHl)} sub="HL/(HL+Tr)" color="bg-[#b71c1c]" />
          </div>

          {/* By recruiter + sparkline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By recruiter table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white text-sm font-bold px-4 py-2.5">👤 Theo Recruiter</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs">
                    <th className="px-3 py-2 text-left">Recruiter</th>
                    <th className="px-3 py-2 text-right">Form Nhập</th>
                    <th className="px-3 py-2 text-right">Hợp Lệ</th>
                    <th className="px-3 py-2 text-right">Trùng</th>
                    <th className="px-3 py-2 text-right">UV Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byRecruiter.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{r.recruiter}</td>
                      <td className="px-3 py-2 text-right">{num(r.formNhap)}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-semibold">{num(r.hopLe)}</td>
                      <td className="px-3 py-2 text-right text-purple-700 font-semibold">{num(r.trung)}</td>
                      <td className="px-3 py-2 text-right font-bold">{num(r.uvNet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sparkline UV Net theo ngày */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">📈 UV Net Theo Ngày — T{String(month).padStart(2,'0')}/{year}</p>
              <Sparkline data={stats.dailyNet} />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{stats.dailyNet[0]?.ngay?.slice(8)}/{stats.dailyNet[0]?.ngay?.slice(5,7)}</span>
                <span>Max: {Math.max(...stats.dailyNet.map(d=>d.count))} UV/ngày</span>
                <span>{stats.dailyNet[stats.dailyNet.length-1]?.ngay?.slice(8)}/{stats.dailyNet[stats.dailyNet.length-1]?.ngay?.slice(5,7)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">🔍 Tra Cứu UV (SĐT hoặc Tên)</p>
        <div className="flex gap-2">
          <input
            type="text" value={query}
            onChange={e => { setQuery(e.target.value); if(!e.target.value) setSearchResults(null) }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Nhập SĐT hoặc tên UV..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <button onClick={handleSearch} disabled={loadingSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {loadingSearch ? '...' : 'Tìm'}
          </button>
          {searchResults && (
            <button onClick={() => { setSearchResults(null); setQuery('') }}
              className="px-3 py-2 text-slate-400 hover:text-slate-700 border border-slate-200 rounded-lg text-sm transition">
              ✕
            </button>
          )}
        </div>

        {searchResults && (
          <div className="mt-3 overflow-x-auto">
            <p className="text-xs text-slate-500 mb-2">Tìm thấy {searchResults.length} kết quả</p>
            {searchResults.length === 0
              ? <p className="text-slate-400 text-sm">Không tìm thấy UV nào.</p>
              : <CandidateTable rows={searchResults} />
            }
          </div>
        )}
      </div>

      {/* Danh sách UV */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">
            📋 Danh Sách UV — T{String(month).padStart(2,'0')}/{year}
            <span className="ml-2 text-slate-400 font-normal text-xs">({num(listTotal)} UV)</span>
          </p>
          <div className="flex items-center gap-2">
            <select value={recruiterFilter} onChange={e => setRecruiterFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none text-slate-600">
              <option value="">Tất cả</option>
              {recruiters.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {loadingList
          ? <p className="text-slate-400 text-sm text-center py-6">Đang tải...</p>
          : (
            <>
              <div className="overflow-x-auto">
                <CandidateTable rows={listData} />
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Trang {listPage}/{totalPages}</p>
                  <div className="flex gap-1">
                    <button disabled={listPage === 1} onClick={() => fetchList(listPage - 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition">
                      ← Trước
                    </button>
                    <button disabled={listPage === totalPages} onClick={() => fetchList(listPage + 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition">
                      Sau →
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        }
      </div>
    </div>
  )
}

// ── Shared table component ─────────────────────────────────────────
function CandidateTable({ rows }: { rows: Candidate[] }) {
  if (rows.length === 0) return <p className="text-slate-400 text-sm p-4">Không có dữ liệu.</p>
  return (
    <table className="w-full text-sm min-w-[700px]">
      <thead>
        <tr className="bg-slate-800 text-white text-xs">
          <th className="px-3 py-2 text-left">Ngày</th>
          <th className="px-3 py-2 text-left">Tên UV</th>
          <th className="px-3 py-2 text-left">SĐT</th>
          <th className="px-3 py-2 text-left">Check SĐT</th>
          <th className="px-3 py-2 text-left">Phân Loại</th>
          <th className="px-3 py-2 text-left">Trạng Thái</th>
          <th className="px-3 py-2 text-left">Recruiter</th>
          <th className="px-3 py-2 text-left">Ghi Chú</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
              {r.ngay_nhap ? r.ngay_nhap.slice(8) + '/' + r.ngay_nhap.slice(5,7) : '—'}
            </td>
            <td className="px-3 py-2 font-medium whitespace-nowrap">{r.ten_uv || '—'}</td>
            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.sdt || '—'}</td>
            <td className="px-3 py-2">{checkBadge(r.check_sdt)}</td>
            <td className="px-3 py-2 text-slate-600 text-xs">{r.phan_loai || '—'}</td>
            <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{r.trang_thai || '—'}</td>
            <td className="px-3 py-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                r.recruiter === 'C.Hoa' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
              }`}>{r.recruiter}</span>
            </td>
            <td className="px-3 py-2 text-slate-500 text-xs max-w-[160px] truncate">{r.ghi_chu || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
