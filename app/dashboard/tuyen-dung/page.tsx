'use client'

import { useState, useEffect, useCallback } from 'react'

// ════════════════════════════════════════════════════════════════
//  TYPES — khớp với JSON trả về từ /api/reports/tuyen-dung
//  (JSON này do Apps Script tính, xem hàm getTuyenDungReportData)
// ════════════════════════════════════════════════════════════════
interface Bang1 {
  formNhapThang: number; targetFormThang: number
  uvNetThang: number; targetUvNetThang: number
  hlNetThang: number; targetHlNetThang: number
  trungNetThang: number; targetTrungThang: number
  tyLeHlThang: number | null
  chuaCheckThang: number
}
interface Bang2Nguon {
  ten: string; uvNet: number; hlNet: number; trungNet: number
  tyLeHl: number | null; chuaCheck: number
}
interface Bang2 {
  tho: {
    formNhap: number; targetFormNgay: number; uvLoc: number
    hlTho: number; pctHlTho: number | null
    trungTho: number; pctTrungTho: number | null
  }
  net: {
    uvNet: number; targetUvNetNgay: number
    hlNet: number; targetHlNetNgay: number
    trungNet: number; targetTrungNgay: number
    tyLeHl: number | null
  }
  nguon: Bang2Nguon[]
}
interface Bang3Row {
  ngay: string; thu: string; formNhap: number; uvLoc: number
  pctHaoHut: number | null; uvNet: number; hlNet: number; trungNet: number
  chuaCheck: number; pctHl: number | null
  isSelected?: boolean; isTotal?: boolean
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

// Định dạng số % — null/undefined -> "N/A"
function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? 'N/A' : v.toFixed(1) + '%'
}

// Component hiển thị 1 card chỉ số — theme sáng
function StatCard({
  label, value, sub, color = 'blue',
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray'
}) {
  const colors = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
    red:    'bg-red-50 border-red-100 text-red-700',
    purple: 'bg-violet-50 border-violet-100 text-violet-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    gray:   'bg-slate-100 border-slate-200 text-slate-600',
  }

  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

// Component bảng dữ liệu — theme sáng
function DataTable({
  headers, rows, selectedRow,
}: {
  headers: string[]
  rows: (string | number)[][]
  selectedRow?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-slate-100 transition
                ${ri === selectedRow
                  ? 'bg-blue-50'
                  : 'hover:bg-slate-50'
                }`}
            >
              {row.map((cell, ci) => (
                <td key={ci} className={`py-3 px-3 ${ci === 0 ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TuyenDungPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )
  const [data, setData]           = useState<ReportData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [connected, setConnected] = useState(false)

  // Định dạng ngày hiển thị
  const dateObj  = new Date(selectedDate + 'T00:00:00')
  const displayDate = dateObj.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  // Gọi API lấy dữ liệu thật từ Google Sheets (qua Apps Script)
  const loadData = useCallback(async (dateStr: string) => {
    setLoading(true)
    setError('')
    try {
      const d = new Date(dateStr + 'T00:00:00')
      const day = d.getDate()
      const month = d.getMonth() + 1
      const year = d.getFullYear()

      const res = await fetch(`/api/reports/tuyen-dung?day=${day}&month=${month}&year=${year}`)
      const json = await res.json()

      if (!res.ok) {
        setConnected(false)
        setData(null)
        setError(json.error || 'Không tải được dữ liệu')
      } else {
        setConnected(true)
        setData(json)
      }
    } catch {
      setConnected(false)
      setData(null)
      setError('Lỗi kết nối tới máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  // Tự động tải dữ liệu khi vào trang
  useEffect(() => {
    loadData(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mStr = data ? String(data.month).padStart(2, '0') : ''
  // Vị trí dòng được highlight trong Bảng 3 (ngày đang chọn)
  const bang3SelectedIdx = data ? data.bang3.findIndex(r => r.isSelected) : -1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo Cáo Tuyển Dụng</h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">{displayDate}</p>
        </div>

        {/* Chọn ngày */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-300 text-slate-900 text-sm
                       rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={() => loadData(selectedDate)}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                       px-4 py-2.5 rounded-xl transition flex items-center gap-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Tải dữ liệu
          </button>
        </div>
      </div>

      {/* Thông báo lỗi / chưa kết nối */}
      {!connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div>
              <p className="text-amber-800 font-medium text-sm">
                {loading ? 'Đang tải dữ liệu từ Google Sheets...' : 'Chưa lấy được dữ liệu từ Google Sheets'}
              </p>
              {!loading && error && (
                <p className="text-amber-700/80 text-sm mt-1">{error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nội dung báo cáo — chỉ hiện khi có dữ liệu thật */}
      {data && (
        <>
          {/* BẢNG 1 — Tiến độ mục tiêu */}
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
              Bảng 1 — Tiến Độ Kết Quả / Mục Tiêu
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Form Nhập (Tháng)" value={data.bang1.formNhapThang} sub={`/ ${data.bang1.targetFormThang} mục tiêu`} color="orange" />
              <StatCard label="UV Net (Tháng)"    value={data.bang1.uvNetThang}    sub={`/ ${data.bang1.targetUvNetThang} mục tiêu`} color="blue" />
              <StatCard label="HL Net"            value={data.bang1.hlNetThang}    sub={`/ ${data.bang1.targetHlNetThang} mục tiêu`} color="green" />
              <StatCard label="Trùng Net"         value={data.bang1.trungNetThang} sub={`/ ${data.bang1.targetTrungThang} mục tiêu`} color="purple" />
              <StatCard label="Tỷ Lệ HL"          value={fmtPct(data.bang1.tyLeHlThang)} sub="HL Net / (HL+Tr) Net" color="orange" />
              <StatCard label="Chưa Check"        value={data.bang1.chuaCheckThang} sub="SĐT chưa xác thực" color="gray" />
            </div>
          </section>

          {/* BẢNG 2 — Ngày hiện tại */}
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block"></span>
              Bảng 2 — Tổng Quan Ngày {dateObj.toLocaleDateString('vi-VN')}
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm shadow-slate-200/40">
              <div className="grid grid-cols-2 gap-5 mb-5">
                {/* Thô */}
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Thô</p>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Form Nhập" value={data.bang2.tho.formNhap} sub={`/ ${data.bang2.tho.targetFormNgay} mục tiêu`} color="orange" />
                    <StatCard label="UV Lọc"    value={data.bang2.tho.uvLoc}    sub={`/ ${data.bang2.tho.targetFormNgay}`}           color="gray" />
                    <StatCard label="HL Thô"    value={data.bang2.tho.hlTho}    sub={`${fmtPct(data.bang2.tho.pctHlTho)} / UV Lọc`}   color="green" />
                    <StatCard label="Trùng Thô" value={data.bang2.tho.trungTho} sub={`${fmtPct(data.bang2.tho.pctTrungTho)} / UV Lọc`} color="red" />
                  </div>
                </div>
                {/* Net */}
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Net</p>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="UV Net"    value={data.bang2.net.uvNet}    sub={`/ ${data.bang2.net.targetUvNetNgay}`} color="blue" />
                    <StatCard label="HL Net"    value={data.bang2.net.hlNet}    sub={`/ ${data.bang2.net.targetHlNetNgay}`} color="green" />
                    <StatCard label="Trùng Net" value={data.bang2.net.trungNet} sub={`/ ${data.bang2.net.targetTrungNgay}`} color="purple" />
                    <StatCard label="Tỷ Lệ HL"  value={fmtPct(data.bang2.net.tyLeHl)} sub="HL/HL+Tr" color="orange" />
                  </div>
                </div>
              </div>

              {/* Nguồn: C.Hoa vs C.Ngọc */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Nguồn</p>
                <DataTable
                  headers={['Nguồn', 'UV Net', 'HL Net', 'Trùng Net', 'Tỷ Lệ HL', 'Chưa Check']}
                  rows={data.bang2.nguon.map(n => [n.ten, n.uvNet, n.hlNet, n.trungNet, fmtPct(n.tyLeHl), n.chuaCheck])}
                />
              </div>
            </div>
          </section>

          {/* BẢNG 3 — 15 ngày gần nhất */}
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-violet-500 rounded-full inline-block"></span>
              Bảng 3 — Chỉ Số UV Các Ngày Trong Tháng
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm shadow-slate-200/40">
              <DataTable
                headers={['Ngày', 'Thứ', 'Form Nhập', 'UV Lọc', '% Hao Hụt', 'UV Net', 'HL Net', 'Trùng Net', 'Chưa Check', '% HL']}
                selectedRow={bang3SelectedIdx}
                rows={data.bang3.map(r => [
                  r.ngay, r.thu, r.formNhap, r.uvLoc, fmtPct(r.pctHaoHut),
                  r.uvNet, r.hlNet, r.trungNet, r.chuaCheck, fmtPct(r.pctHl),
                ])}
              />
            </div>
          </section>

          {/* BẢNG 4 — Phân bổ theo Mã Trang */}
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-orange-500 rounded-full inline-block"></span>
              Bảng 4 — Phân Bổ UV Theo Nguồn / Mã Trang ({mStr}/{data.year})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.bang4.map(page => (
                <div key={page.maTrang} className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm shadow-slate-200/40">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-slate-900 font-medium text-sm">{page.tenTrang}</p>
                  </div>
                  <div className="p-2">
                    <DataTable
                      headers={['Ngày', 'Thứ', 'Thô', 'Lọc', 'Net', '%HH', 'HL Net', 'Trùng', '%HL']}
                      rows={page.days.map(d => [
                        d.ngay, d.thu, d.tho, d.loc, d.net, fmtPct(d.pctHH), d.hlNet, d.trungNet, fmtPct(d.pctHl),
                      ])}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
