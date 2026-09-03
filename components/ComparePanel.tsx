'use client'

/**
 * ComparePanel — So sánh 2 tab cạnh nhau.
 *
 * Mỗi trang tự tính `rows` từ data của 2 tab rồi truyền vào đây.
 * Panel chỉ lo render bảng + chọn tab, không biết cấu trúc data cụ thể.
 */

export interface CompareRow {
  label: string
  a: number | null        // giá trị tab A
  b: number | null        // giá trị tab B
  isPercent?: boolean     // hiển thị dạng xx.x%
  isSeparator?: boolean   // dòng tiêu đề nhóm (không tính diff)
}

interface TabOption {
  id: string
  label: string     // tên hiển thị, vd "T9/2026" hay "01/09/2026"
  hasData: boolean
}

interface Props {
  tabs: TabOption[]
  tabAId: string
  tabBId: string
  onTabAChange: (id: string) => void
  onTabBChange: (id: string) => void
  rows: CompareRow[]
  onClose: () => void
}

function fmt(v: number | null, isPercent?: boolean): string {
  if (v === null) return '—'
  if (isPercent) return v.toFixed(1) + '%'
  return v.toLocaleString()
}

function diffClass(diff: number): string {
  if (diff > 0) return 'text-emerald-600 font-semibold'
  if (diff < 0) return 'text-red-500 font-semibold'
  return 'text-slate-400'
}

function diffLabel(diff: number, isPercent?: boolean): string {
  if (diff === 0) return '='
  const sign = diff > 0 ? '+' : ''
  if (isPercent) return `${sign}${diff.toFixed(1)}%`
  return `${sign}${diff.toLocaleString()}`
}

export default function ComparePanel({
  tabs, tabAId, tabBId, onTabAChange, onTabBChange, rows, onClose
}: Props) {
  const tabA = tabs.find(t => t.id === tabAId)
  const tabB = tabs.find(t => t.id === tabBId)

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4 no-print"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">⚖️ So sánh 2 tab</h2>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none transition">×</button>
        </div>

        {/* Tab selectors */}
        <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide w-5">A</span>
            <select value={tabAId} onChange={e => onTabAChange(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {tabs.map(t => (
                <option key={t.id} value={t.id} disabled={t.id === tabBId}>
                  {t.label}{!t.hasData ? ' (chưa tải)' : ''}
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-300 font-bold">vs</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide w-5">B</span>
            <select value={tabBId} onChange={e => onTabBChange(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              {tabs.map(t => (
                <option key={t.id} value={t.id} disabled={t.id === tabAId}>
                  {t.label}{!t.hasData ? ' (chưa tải)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">
              Chọn 2 tab đã có dữ liệu để so sánh.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-slate-500 font-medium">Chỉ số</th>
                  <th className="text-right px-4 py-2.5 text-blue-600 font-semibold">
                    {tabA?.label ?? 'A'}
                  </th>
                  <th className="text-right px-4 py-2.5 text-orange-500 font-semibold">
                    {tabB?.label ?? 'B'}
                  </th>
                  <th className="text-right px-5 py-2.5 text-slate-500 font-medium">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  if (row.isSeparator) {
                    return (
                      <tr key={i} className="bg-slate-50">
                        <td colSpan={4} className="px-5 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {row.label}
                        </td>
                      </tr>
                    )
                  }
                  const a = row.a
                  const b = row.b
                  const diff = (a !== null && b !== null) ? a - b : null
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-5 py-2.5 text-slate-700">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {fmt(a, row.isPercent)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {fmt(b, row.isPercent)}
                      </td>
                      <td className={`px-5 py-2.5 text-right ${diff !== null ? diffClass(diff) : 'text-slate-300'}`}>
                        {diff !== null ? diffLabel(diff, row.isPercent) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          Chênh lệch = A − B &nbsp;|&nbsp; <span className="text-emerald-600 font-semibold">+xanh</span> = A cao hơn &nbsp;|&nbsp; <span className="text-red-500 font-semibold">−đỏ</span> = A thấp hơn
        </div>
      </div>
    </div>
  )
}
