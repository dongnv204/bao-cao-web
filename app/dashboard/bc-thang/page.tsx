'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────
interface TongQuan {
  tongUVNhap: number; hopLeTho: number; trungTho: number; chuaCheck: number
  hlNet: number; trungNet: number; tongUVNet: number; kyHDTotal: number
  kyHD: number; duyet: number; daoTao: number; dauPV: number
  coLich: number; baoLich: number; chuaCo: number; khac: number
  hlLan2: number; trungLan2: number
}
interface PheuRow      { label: string; val: number }
interface WeekRow      { week: number; label: string; hlNet: number }
interface TTRow        { trangThai: string; soLuong: number }
interface PLRow        { phanLoai: string; soLuong: number }
interface ThiTruongRow { label: string; uvNet: number; hlNet: number; trungNet: number; chuaCheck: number }

interface BCThangData {
  month: number; year: number; updatedAt: string; empty: boolean; message?: string
  tongQuan?: TongQuan; pheu?: PheuRow[]; weeklyHL?: WeekRow[]
  trangThaiList?: TTRow[]; phanLoaiList?: PLRow[]; byThiTruong?: ThiTruongRow[]
}

// ── Helper ─────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%'
const n   = (v: number) => (v ?? 0).toLocaleString()

export default function BCThangPage() {
  const now = new Date()
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [year,    setYear]    = useState(now.getFullYear())
  const [data,    setData]    = useState<BCThangData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch(`/api/reports/bc-thang?month=${month}&year=${year}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
      setData(await res.json())
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [month, year])

  // Xoá cache server rồi tải lại
  const [refreshing, setRefreshing] = useState(false)
  const refreshData = async () => {
    setRefreshing(true)
    await fetch(`/api/revalidate?tag=bc-thang`, { method: 'POST' }).catch(() => {})
    await fetchData()
    setRefreshing(false)
  }

  useEffect(() => { fetchData() }, [fetchData])

  const tq    = data?.tongQuan
  const tyLe  = tq ? pct(tq.hlNet, tq.hlNet + tq.trungNet) : '—'

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo Cáo Tháng — Tuyển Dụng</h1>
          {data && !data.empty && (
            <p className="text-xs text-slate-400 mt-0.5">Cập nhật: {data.updatedAt}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({length:12},(_,i)=>i+1).map(m=>(
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Đang tải...' : 'Xem'}
          </button>
          <button onClick={refreshData} disabled={loading || refreshing}
            title="Xoá cache và tải dữ liệu mới nhất từ Google Sheets"
            className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-50 transition">
            {refreshing ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {/* ── States ──────────────────────────────────────────────────── */}
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

      {tq && (
        <>
          {/* ── Bảng 1 — Tổng quan tháng ──────────────────────────── */}
          <Section title="BẢNG 1 — TỔNG QUAN THÁNG">

            {/* Hàng 1: KPI chính */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Tổng UV Net"  value={n(tq.tongUVNet)} sub="HL Net + Trùng Net"                               bg="bg-blue-600"  />
              <KpiCard label="Hợp Lệ Net"   value={n(tq.hlNet)}    sub={pct(tq.hlNet,tq.tongUVNet)+' / Net'}              bg="bg-green-700" />
              <KpiCard label="Trùng Net"    value={n(tq.trungNet)}  sub={pct(tq.trungNet,tq.tongUVNet)+' / Net'}           bg="bg-red-700"   />
              <KpiCard label="Tỷ Lệ HL"     value={tyLe}           sub="HL Net / (HL + Trùng)"                            bg="bg-orange-500" isText />
            </div>

            {/* Hàng 2: Lịch hẹn */}
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Chưa Check"    value={n(tq.chuaCheck)} sub={pct(tq.chuaCheck,tq.tongUVNet)+' / Net'}        bg="bg-slate-500" />
              <KpiCard label="Chưa Có Lịch" value={n(tq.chuaCo)}    sub={pct(tq.chuaCo,tq.hlNet)+' / HL Net'}            bg="bg-orange-500" />
              <KpiCard label="Báo Lịch Sau" value={n(tq.baoLich)}   sub={pct(tq.baoLich,tq.hlNet)+' / HL Net'}           bg="bg-amber-500"  />
              <KpiCard label="Có Lịch PV"   value={n(tq.coLich)}    sub={pct(tq.coLich,tq.hlNet)+' / HL Net'}            bg="bg-teal-600"   />
            </div>

            {/* Hàng 3: Phễu cuối */}
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Đậu PV"  value={n(tq.dauPV)}  sub={pct(tq.dauPV,tq.hlNet)+' / HL Net'}   bg="bg-purple-700" />
              <KpiCard label="Đào Tạo" value={n(tq.daoTao)} sub={pct(tq.daoTao,tq.hlNet)+' / HL Net'}  bg="bg-purple-600" />
              <KpiCard label="Ký HĐ"   value={n(tq.kyHD)}   sub={pct(tq.kyHD,tq.hlNet)+' / HL Net'}    bg="bg-green-800"  />
              <KpiCard label="Duyệt"   value={n(tq.duyet)}  sub={pct(tq.duyet,tq.hlNet)+' / HL Net'}   bg="bg-green-700"  />
            </div>

            {/* Hàng 4: Khác */}
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Chỉ Số Khác" value={n(tq.khac)} sub={pct(tq.khac,tq.hlNet)+' / HL Net'} bg="bg-slate-600" />
            </div>

            {/* Thông tin bổ sung */}
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">
                — Thông tin bổ sung — Đối chiếu &amp; Tham khảo —
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Tổng UV Nhập" value={n(tq.tongUVNhap)} sub="100% — toàn bộ UV nhập tháng"       bg="bg-slate-800" />
                <KpiCard label="Hợp Lệ Thô"   value={n(tq.hopLeTho)}  sub={pct(tq.hopLeTho,tq.tongUVNhap)+' / Tổng'} bg="bg-green-800" />
                <KpiCard label="Trùng Thô"     value={n(tq.trungTho)}  sub={pct(tq.trungTho,tq.tongUVNhap)+' / Tổng'} bg="bg-red-800"   />
                <KpiCard label="Chưa Check"    value={n(tq.chuaCheck)} sub={pct(tq.chuaCheck,tq.tongUVNhap)+' / Tổng'} bg="bg-slate-600" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <KpiCard label="HL Lần 2 (loại)"    value={n(tq.hlLan2)}    sub="Cùng tên + ngày, HL từ lần 2 trở lên"    bg="bg-blue-700" />
                <KpiCard label="Trùng Lần 2 (loại)" value={n(tq.trungLan2)} sub="Cùng tên + ngày, Trùng từ lần 2 trở lên" bg="bg-purple-700" />
              </div>
            </div>
          </Section>

          {/* ── Bảng 2 — Phễu chuyển đổi ─────────────────────────── */}
          {data.pheu && data.pheu.length > 0 && (
            <Section title="BẢNG 2 — TỔNG SỐ LƯỢNG QUA CÁC KHÂU & TỶ LỆ CHUYỂN ĐỔI (UV Hợp Lệ Net)">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-600 text-white text-xs">
                      <th className="py-2.5 px-4 text-left font-semibold">Phễu Chuyển Đổi</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Số lượng</th>
                      <th className="py-2.5 px-4 text-right font-semibold">% / Net</th>
                      <th className="py-2.5 px-4 text-right font-semibold">% / HL Net</th>
                      <th className="py-2.5 px-3 w-36">Thanh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pheu.map((row, i) => {
                      const uvNet = data.pheu![0].val || 1
                      const hlNet = data.pheu![1]?.val || 1
                      const isHL  = i === 1
                      const barPct = Math.round((row.val / uvNet) * 100)
                      return (
                        <tr key={i} className={`border-b border-slate-100 ${isHL ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                          <td className={`py-2.5 px-4 ${isHL ? 'font-semibold text-green-800' : 'text-slate-700'}`}>{row.label}</td>
                          <td className={`py-2.5 px-4 text-right font-bold ${isHL ? 'text-green-700' : 'text-slate-900'}`}>{n(row.val)}</td>
                          <td className="py-2.5 px-4 text-right text-slate-400 text-xs">{pct(row.val, uvNet)}</td>
                          <td className="py-2.5 px-4 text-right text-slate-400 text-xs">{i > 0 ? pct(row.val, hlNet) : '—'}</td>
                          <td className="py-2.5 px-3">
                            <div className="bg-slate-100 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full transition-all ${isHL ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{width:`${barPct}%`}} />
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

          {/* ── Bảng 3 — Theo tuần ────────────────────────────────── */}
          {data.weeklyHL && data.weeklyHL.length > 0 && (
            <Section title="BẢNG 3 — THỐNG KÊ HL NET THEO TUẦN">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700 text-white text-xs">
                      <th className="py-2.5 px-4 text-left font-semibold">Tuần</th>
                      <th className="py-2.5 px-4 text-left font-semibold">Thời gian</th>
                      <th className="py-2.5 px-4 text-right font-semibold">HL Net</th>
                      <th className="py-2.5 px-4 text-right font-semibold">% / Tổng</th>
                      <th className="py-2.5 px-3 w-36">Thanh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxHL = Math.max(...(data.weeklyHL?.map(w=>w.hlNet) ?? [1]), 1)
                      return data.weeklyHL!.map(w => (
                        <tr key={w.week} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-slate-700">T{w.week}</td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs">{w.label}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-blue-700">{w.hlNet}</td>
                          <td className="py-2.5 px-4 text-right text-slate-400 text-xs">{pct(w.hlNet, tq.hlNet)}</td>
                          <td className="py-2.5 px-3">
                            <div className="bg-slate-100 rounded-full h-2.5">
                              <div className="bg-blue-500 h-2.5 rounded-full" style={{width:`${Math.round(w.hlNet/maxHL*100)}%`}} />
                            </div>
                          </td>
                        </tr>
                      ))
                    })()}
                    <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                      <td className="py-2.5 px-4 text-blue-700" colSpan={2}>Tổng</td>
                      <td className="py-2.5 px-4 text-right text-blue-700">{n(tq.hlNet)}</td>
                      <td className="py-2.5 px-4 text-right text-blue-400 text-xs">100%</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── Bảng 4+5 — Trạng thái & Phân loại ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {data.trangThaiList && data.trangThaiList.length > 0 && (
              <Section title="BẢNG 4 — TRẠNG THÁI (UV Hợp Lệ Net)">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-600 text-white text-xs">
                        <th className="py-2 px-3 text-left font-semibold">STT</th>
                        <th className="py-2 px-3 text-left font-semibold">Trạng Thái</th>
                        <th className="py-2 px-3 text-right font-semibold">SL</th>
                        <th className="py-2 px-3 text-right font-semibold">Tỷ Lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trangThaiList.map((r,i)=>(
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-400 text-xs">{i+1}</td>
                          <td className="py-2 px-3 text-slate-700">{r.trangThai}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{r.soLuong}</td>
                          <td className="py-2 px-3 text-right text-slate-400 text-xs">{pct(r.soLuong,tq.hlNet)}</td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-200 text-blue-700">
                        <td className="py-2 px-3" colSpan={2}>TỔNG</td>
                        <td className="py-2 px-3 text-right">{n(tq.hlNet)}</td>
                        <td className="py-2 px-3 text-right text-xs">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {data.phanLoaiList && data.phanLoaiList.length > 0 && (
              <Section title="BẢNG 5 — PHÂN LOẠI (UV Hợp Lệ Net)">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-600 text-white text-xs">
                        <th className="py-2 px-3 text-left font-semibold">STT</th>
                        <th className="py-2 px-3 text-left font-semibold">Phân Loại</th>
                        <th className="py-2 px-3 text-right font-semibold">SL</th>
                        <th className="py-2 px-3 text-right font-semibold">Tỷ Lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.phanLoaiList.map((r,i)=>(
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-400 text-xs">{i+1}</td>
                          <td className="py-2 px-3 text-slate-700">{r.phanLoai}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{r.soLuong}</td>
                          <td className="py-2 px-3 text-right text-slate-400 text-xs">{pct(r.soLuong,tq.hlNet)}</td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-200 text-blue-700">
                        <td className="py-2 px-3" colSpan={2}>TỔNG</td>
                        <td className="py-2 px-3 text-right">{n(tq.hlNet)}</td>
                        <td className="py-2 px-3 text-right text-xs">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>

          {/* ── Bảng 6 — Thị Trường ──────────────────────────────── */}
          {data.byThiTruong && data.byThiTruong.length > 0 && (
            <Section title="BẢNG 6 — THỐNG KÊ THEO THỊ TRƯỜNG (UV Net: HL + Trùng + Chưa Check)">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-600 text-white text-xs">
                      <th className="py-2.5 px-3 text-left font-semibold">STT</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Thị Trường</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Tổng UV</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-green-200">Hợp Lệ</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-red-200">Trùng</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Chưa Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byThiTruong.map((r,i)=>(
                      <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2===1?'bg-slate-50/50':''}`}>
                        <td className="py-2 px-3 text-slate-400 text-xs">{i+1}</td>
                        <td className="py-2 px-3 text-slate-700 font-medium">{r.label}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{n(r.uvNet)}</td>
                        <td className="py-2 px-3 text-right font-bold text-green-700">{n(r.hlNet)}</td>
                        <td className="py-2 px-3 text-right font-bold text-red-600">{n(r.trungNet)}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{n(r.chuaCheck)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-600 text-white font-bold text-sm">
                      <td className="py-2.5 px-3" colSpan={2}>TỔNG</td>
                      <td className="py-2.5 px-3 text-right">{n(tq.hlNet+tq.trungNet+tq.chuaCheck)}</td>
                      <td className="py-2.5 px-3 text-right">{n(tq.hlNet)}</td>
                      <td className="py-2.5 px-3 text-right">{n(tq.trungNet)}</td>
                      <td className="py-2.5 px-3 text-right">{n(tq.chuaCheck)}</td>
                    </tr>
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

// ── Sub-components ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-xs font-bold text-slate-600 tracking-wide">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function KpiCard({ label, value, sub, bg, isText = false }: {
  label: string; value: string; sub?: string; bg: string; isText?: boolean
}) {
  return (
    <div className={`${bg} text-white rounded-xl px-4 py-3`}>
      <p className="text-xs opacity-80 mb-1 font-medium">{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1.5">{sub}</p>}
    </div>
  )
}
