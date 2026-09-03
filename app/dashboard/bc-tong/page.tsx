'use client'

import { useState, useEffect, useCallback } from 'react'

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
export default function BCTongPage() {
  const now   = new Date()
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [year,    setYear]    = useState(now.getFullYear())
  const [data,    setData]    = useState<BCTongData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch(`/api/reports/bc-tong?month=${month}&year=${year}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
      setData(await res.json())
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [month, year])

  useEffect(() => { fetchData() }, [fetchData])

  const tq = data?.tongQuan

  return (
    <div className="space-y-6">
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
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Đang tải...' : 'Xem'}
          </button>
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
