'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────
interface TongQuan {
  tongUVNhap: number
  hopLeTho:   number
  trungTho:   number
  chuaCheck:  number
  hlNet:      number
  trungNet:   number
  tongUVNet:  number
  kyHDTotal:  number
  kyHD:       number
  duyet:      number
  daoTao:     number
  dauPV:      number
  coLich:     number
  baoLich:    number
  chuaCo:     number
  khac:       number
  hlLan2:     number
  trungLan2:  number
}

interface PheuRow  { label: string; val: number }
interface WeekRow  { week: number; label: string; hlNet: number }
interface TTRow    { trangThai: string; soLuong: number }
interface PLRow    { phanLoai:  string; soLuong: number }

interface BCThangData {
  month:         number
  year:          number
  updatedAt:     string
  empty:         boolean
  message?:      string
  tongQuan?:     TongQuan
  pheu?:         PheuRow[]
  weeklyHL?:     WeekRow[]
  trangThaiList?: TTRow[]
  phanLoaiList?:  PLRow[]
}

// ── Component ─────────────────────────────────────────────────────────
export default function BCThangPage() {
  const now   = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [data,  setData]  = useState<BCThangData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const res = await fetch(`/api/reports/bc-thang?month=${month}&year=${year}`)
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { fetchData() }, [fetchData])

  const tq = data?.tongQuan

  return (
    <div className="space-y-6">
      {/* Tiêu đề + bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo Cáo Tháng — Tuyển Dụng</h1>
          {data && !data.empty && (
            <p className="text-xs text-slate-400 mt-0.5">Cập nhật: {data.updatedAt}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {data?.empty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">
          📭 {data.message}
        </div>
      )}

      {/* Bảng 1 — Tổng quan */}
      {tq && (
        <>
          <Section title="Bảng 1 — Tổng quan">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard label="Tổng UV Nhập"  value={tq.tongUVNhap}  color="blue" />
              <StatCard label="Hợp Lệ Thô"    value={tq.hopLeTho}    color="green" />
              <StatCard label="Trùng Thô"      value={tq.trungTho}    color="orange" />
              <StatCard label="Chưa Check"     value={tq.chuaCheck}   color="slate" />
              <StatCard label="HL Net"         value={tq.hlNet}       color="green" bold />
              <StatCard label="Trùng Net"      value={tq.trungNet}    color="orange" bold />
              <StatCard label="Tổng UV Net"    value={tq.tongUVNet}   color="blue" bold />
              <StatCard label="Ký HĐ + Duyệt" value={tq.kyHDTotal}   color="purple" bold />
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard label="Ký HĐ"      value={tq.kyHD}    color="purple" />
              <StatCard label="Duyệt"      value={tq.duyet}   color="purple" />
              <StatCard label="Đào Tạo"    value={tq.daoTao}  color="indigo" />
              <StatCard label="Đậu PV"     value={tq.dauPV}   color="indigo" />
              <StatCard label="Có Lịch"    value={tq.coLich}  color="cyan" />
              <StatCard label="Báo Lịch"   value={tq.baoLich} color="cyan" />
              <StatCard label="Chưa Có"    value={tq.chuaCo}  color="slate" />
              <StatCard label="Khác"       value={tq.khac}    color="slate" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatCard label="HL Lần 2 (loại)" value={tq.hlLan2}    color="red" />
              <StatCard label="Trùng Lần 2 (loại)" value={tq.trungLan2} color="red" />
            </div>
          </Section>

          {/* Bảng 2 — Phễu chuyển đổi */}
          {data.pheu && data.pheu.length > 0 && (
            <Section title="Bảng 2 — Phễu chuyển đổi">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Bước</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Số lượng</th>
                      <th className="py-2 px-3 text-slate-500 font-medium w-48">Thanh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pheu.map((row, i) => {
                      const max = data.pheu![0].val || 1
                      const pct = Math.round((row.val / max) * 100)
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-700">{row.label}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{row.val.toLocaleString()}</td>
                          <td className="py-2.5 px-3">
                            <div className="bg-slate-100 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Bảng 3 — Theo tuần */}
          {data.weeklyHL && data.weeklyHL.length > 0 && (
            <Section title="Bảng 3 — HL Net theo tuần">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Tuần</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Thời gian</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">HL Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeklyHL.map(w => (
                      <tr key={w.week} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-600 font-medium">Tuần {w.week}</td>
                        <td className="py-2.5 px-3 text-slate-500">{w.label}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-blue-600">{w.hlNet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Bảng 4 — Trạng thái & Phân loại */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.trangThaiList && data.trangThaiList.length > 0 && (
              <Section title="Trạng Thái (HL Net)">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Trạng thái</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">SL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trangThaiList.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-700">{r.trangThai}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">{r.soLuong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {data.phanLoaiList && data.phanLoaiList.length > 0 && (
              <Section title="Phân Loại (HL Net)">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Phân loại</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">SL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.phanLoaiList.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-700">{r.phanLoai}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">{r.soLuong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────

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

const COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  cyan:   'bg-cyan-50 text-cyan-700 border-cyan-100',
  red:    'bg-red-50 text-red-600 border-red-100',
  slate:  'bg-slate-50 text-slate-600 border-slate-100',
}

function StatCard({
  label, value, color = 'slate', bold = false
}: {
  label: string; value: number; color?: string; bold?: boolean
}) {
  const cls = COLOR_MAP[color] || COLOR_MAP.slate
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className={`text-2xl ${bold ? 'font-bold' : 'font-semibold'}`}>
        {value?.toLocaleString() ?? '—'}
      </p>
    </div>
  )
}
