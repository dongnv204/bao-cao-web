'use client'

/**
 * DrilldownPanel — hiện chi tiết khu vực (byThiTruong) khi click vào bar trong GroupTotalChart.
 *
 * Cách dùng:
 *   {drillGroup && (
 *     <DrilldownPanel {...drillGroup} onClose={() => setDrillGroup(null)} />
 *   )}
 */

// ── Types ─────────────────────────────────────────────────────────────
export interface DrilldownPanelProps {
  label: string                              // tên nhóm, vd: "Duyệt"
  color: string                              // màu nhóm: 'blue' | 'orange' | 'green' | 'indigo'
  total: number                              // tổng nhóm
  rows: { label: string; val: number }[]     // byThiTruong
  onClose: () => void
}

// ── Màu theo nhóm ─────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bar: string; badge: string; bg: string }> = {
  blue:   { bar: '#3B82F6', badge: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'   },
  orange: { bar: '#F97316', badge: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  green:  { bar: '#10B981', badge: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  indigo: { bar: '#6366F1', badge: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200'  },
}

export function DrilldownPanel({ label, color, total, rows, onClose }: DrilldownPanelProps) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue

  // Sắp xếp giảm dần, lấy top 10
  const sorted = [...rows].sort((a, b) => b.val - a.val).slice(0, 10)
  const max    = sorted[0]?.val ?? 1

  return (
    <div className={`rounded-2xl border p-5 ${c.bg} animate-[fadeIn_0.18s_ease]`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Chi tiết khu vực</p>
          <h3 className={`text-lg font-bold mt-0.5 ${c.badge}`}>{label}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${c.badge}`}>{total.toLocaleString()}</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition text-xl leading-none"
            aria-label="Đóng drill-down"
          >
            ×
          </button>
        </div>
      </div>

      {/* Danh sách khu vực */}
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Không có dữ liệu khu vực</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r, i) => {
            const pct = Math.round((r.val / max) * 100)
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-700 truncate max-w-[75%] font-medium">{r.label}</span>
                  <span className={`font-bold tabular-nums ${c.badge}`}>{r.val.toLocaleString()}</span>
                </div>
                <div className="bg-white/60 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: c.bar }}
                  />
                </div>
              </div>
            )
          })}
          {rows.length > 10 && (
            <p className="text-xs text-slate-400 text-center pt-1">
              + {rows.length - 10} khu vực khác
            </p>
          )}
        </div>
      )}
    </div>
  )
}
