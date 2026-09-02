'use client'

import { useState } from 'react'

// Component hiển thị 1 card chỉ số
function StatCard({
  label, value, sub, color = 'blue',
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray'
}) {
  const colors = {
    blue:   'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    red:    'bg-red-500/10 border-red-500/20 text-red-400',
    purple: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    gray:   'bg-slate-500/10 border-slate-500/20 text-slate-400',
  }

  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  )
}

// Component bảng dữ liệu
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
          <tr className="border-b border-slate-700">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-slate-800 transition
                ${ri === selectedRow
                  ? 'bg-blue-600/10 border-blue-600/20'
                  : 'hover:bg-slate-800/50'
                }`}
            >
              {row.map((cell, ci) => (
                <td key={ci} className={`py-3 px-3 ${ci === 0 ? 'font-medium text-white' : 'text-slate-300'}`}>
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
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)

  // Định dạng ngày hiển thị
  const dateObj  = new Date(selectedDate + 'T00:00:00')
  const displayDate = dateObj.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Báo Cáo Tuyển Dụng</h1>
          <p className="text-slate-400 text-sm mt-1 capitalize">{displayDate}</p>
        </div>

        {/* Chọn ngày */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm
                       rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={() => setLoading(true)}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                       px-4 py-2.5 rounded-xl transition flex items-center gap-2"
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

      {/* Thông báo chưa kết nối Apps Script */}
      {!connected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-xl">⚠️</span>
            <div>
              <p className="text-amber-300 font-medium text-sm">Chưa kết nối Google Sheets</p>
              <p className="text-amber-400/70 text-sm mt-1">
                Cần cấu hình <code className="bg-amber-500/20 px-1 rounded">APPS_SCRIPT_URL</code> trong file{' '}
                <code className="bg-amber-500/20 px-1 rounded">.env.local</code> để lấy dữ liệu thật từ Google Sheets.
                Hiện tại đang hiển thị dữ liệu mẫu.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BẢNG 1 — Tiến độ mục tiêu */}
      <section>
        <h2 className="text-base font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
          Bảng 1 — Tiến Độ Kết Quả / Mục Tiêu
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Form Nhập (Tháng)" value="136" sub="/ 3.300 mục tiêu" color="orange" />
          <StatCard label="UV Net (Tháng)"    value="10"  sub="/ 3.000 mục tiêu" color="blue" />
          <StatCard label="HL Net"            value="5"   sub="/ 1.500 mục tiêu" color="green" />
          <StatCard label="Trùng Net"         value="5"   sub="/ 1.500 mục tiêu" color="purple" />
          <StatCard label="Tỷ Lệ HL"         value="50%" sub="HL Net / (HL+Tr) Net" color="orange" />
          <StatCard label="Chưa Check"        value="122" sub="SĐT chưa xác thực" color="gray" />
        </div>
      </section>

      {/* BẢNG 2 — Ngày hiện tại */}
      <section>
        <h2 className="text-base font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block"></span>
          Bảng 2 — Tổng Quan Ngày {dateObj.toLocaleDateString('vi-VN')}
        </h2>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Thô */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Thô</p>
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Form Nhập" value="68"  sub="/ 110 mục tiêu" color="orange" />
                <StatCard label="UV Lọc"    value="67"  sub="/ 110"           color="gray" />
                <StatCard label="HL Thô"    value="2"   sub="3.0% / UV Lọc"   color="green" />
                <StatCard label="Trùng Thô" value="3"   sub="4.5% / UV Lọc"   color="red" />
              </div>
            </div>
            {/* Net */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Net</p>
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="UV Net"    value="5"     sub="/ 100"     color="blue" />
                <StatCard label="HL Net"    value="2"     sub="/ 50"      color="green" />
                <StatCard label="Trùng Net" value="3"     sub="/ 50"      color="purple" />
                <StatCard label="Tỷ Lệ HL" value="40.0%" sub="HL/HL+Tr"  color="orange" />
              </div>
            </div>
          </div>

          {/* C.Hoa vs C.Ngoc */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Nguồn</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-xs text-slate-400">Nguồn</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400">UV Net</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400">HL Net</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400">Trùng Net</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400">Tỷ Lệ HL</th>
                    <th className="text-center py-2 px-3 text-xs text-slate-400">Chưa Check</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2.5 px-3 font-medium text-blue-400">C.Hoa</td>
                    <td className="py-2.5 px-3 text-center text-slate-300">3</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400">2</td>
                    <td className="py-2.5 px-3 text-center text-violet-400">1</td>
                    <td className="py-2.5 px-3 text-center text-orange-400">66.7%</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">20</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-purple-400">C.Ngọc</td>
                    <td className="py-2.5 px-3 text-center text-slate-300">2</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400">0</td>
                    <td className="py-2.5 px-3 text-center text-violet-400">2</td>
                    <td className="py-2.5 px-3 text-center text-orange-400">0.0%</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">42</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* BẢNG 3 — 15 ngày gần nhất */}
      <section>
        <h2 className="text-base font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-violet-500 rounded-full inline-block"></span>
          Bảng 3 — Chỉ Số UV Các Ngày Trong Tháng
        </h2>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <DataTable
            headers={['Ngày', 'Thứ', 'Form Nhập', 'UV Lọc', '% Hao Hụt', 'UV Net', 'HL Net', 'Trùng Net', 'Chưa Check', '% HL']}
            selectedRow={0}
            rows={[
              ['02/09/2026', 'T4', 68,  67,  '92.6%', 5,  2,  3,  62, '40.0%'],
              ['01/09/2026', 'T3', 68,  66,  '92.6%', 5,  3,  2,  60, '60.0%'],
              ['25/08/2026', 'T2', 70,  68,  '38.6%', 43, 25, 18, 14, '58.1%'],
              ['24/08/2026', 'CN', 77,  72,  '16.9%', 64, 32, 32, 0,  '50.0%'],
              ['23/08/2026', 'T7', 68,  67,  '14.7%', 58, 38, 20, 5,  '65.5%'],
              ['22/08/2026', 'T6', 53,  50,  '20.8%', 42, 19, 23, 1,  '45.2%'],
              ['21/08/2026', 'T5', 67,  66,  '10.4%', 60, 23, 37, 0,  '38.3%'],
              ['20/08/2026', 'T4', 50,  49,  '10.0%', 45, 26, 19, 0,  '57.8%'],
              ['19/08/2026', 'T3', 88,  82,  '17.0%', 73, 37, 36, 0,  '50.7%'],
              ['18/08/2026', 'T2', 94,  88,  '16.0%', 79, 34, 45, 0,  '43.0%'],
              ['Tổng tháng', '',   136, 133, '92.6%', 10, 5,  5,  122, '50.0%'],
            ]}
          />
        </div>
      </section>

      {/* BẢNG 4 — Phân bổ theo Mã Trang */}
      <section>
        <h2 className="text-base font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-orange-500 rounded-full inline-block"></span>
          Bảng 4 — Phân Bổ UV Theo Nguồn / Mã Trang
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Bác Tài Xanh TAXI',     color: 'border-blue-500/30 bg-blue-500/5' },
            { name: 'TD TAXI Toàn Quốc',      color: 'border-emerald-500/30 bg-emerald-500/5' },
            { name: 'Đăng Ký Bác Tài Xanh',  color: 'border-violet-500/30 bg-violet-500/5' },
            { name: 'TD TAXI XANH',           color: 'border-orange-500/30 bg-orange-500/5' },
          ].map(page => (
            <div key={page.name} className={`border ${page.color} rounded-2xl overflow-hidden`}>
              <div className="px-4 py-3 border-b border-slate-700/50">
                <p className="text-white font-medium text-sm">{page.name}</p>
              </div>
              <div className="p-2">
                <DataTable
                  headers={['Ngày', 'Thứ', 'Thô', 'Lọc', 'Net', '%HH', 'HL Net', 'Trùng', '%HL']}
                  rows={[
                    ['02/09', 'T4', 1, 1, 1, '0.0%',  1, 0, '100%'],
                    ['01/09', 'T3', 28, 28, 1, '96.4%', 0, 1, '0%'],
                    ['25/08', 'T2', 23, 23, 11, '52.2%', 6, 5, '54.5%'],
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
