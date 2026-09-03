'use client'

/**
 * ExportButtons — nút Xuất Excel và Xuất PDF dùng chung cho các trang báo cáo.
 * Props:
 *   onExcelClick — hàm gọi khi bấm Excel (truyền hàm export từng trang vào)
 *   disabled      — ẩn/disable khi chưa có data
 */
interface Props {
  onExcelClick: () => void
  disabled?: boolean
}

export default function ExportButtons({ onExcelClick, disabled }: Props) {
  return (
    <div className="flex items-center gap-2 no-print" data-no-print>
      {/* Xuất Excel */}
      <button
        onClick={onExcelClick}
        disabled={disabled}
        title="Xuất ra file Excel (.xlsx)"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="16" y2="17"/>
        </svg>
        Excel
      </button>

      {/* Xuất PDF */}
      <button
        onClick={() => window.print()}
        disabled={disabled}
        title="In trang hoặc lưu PDF"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        PDF
      </button>
    </div>
  )
}
