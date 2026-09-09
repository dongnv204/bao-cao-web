'use client'

/**
 * RecruitChart — Recharts wrappers dùng chung cho BC Tháng / BC Tổng / BC Ngày
 * Tất cả chart đều responsive và tương thích dark mode (bg inherit từ parent).
 */

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

// ── Palette ──────────────────────────────────────────────────────────
const C = {
  blue:   '#3B82F6',
  green:  '#10B981',
  red:    '#EF4444',
  orange: '#F97316',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  teal:   '#14B8A6',
  amber:  '#F59E0B',
}

// ── Custom tooltip ────────────────────────────────────────────────────
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[120px]">
      <p className="font-semibold text-slate-600 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-medium tabular-nums">{Number(p.value).toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

// ── 1. Phễu ngang (pheu[] của BC Tháng) ──────────────────────────────
export interface FunnelRow { label: string; val: number }
export function FunnelChart({ data }: { data: FunnelRow[] }) {
  const SHADES = [C.blue, C.indigo, C.purple, '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE', '#F5F3FF']
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip content={<Tip />} />
        <Bar dataKey="val" name="Số lượng" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 11, fill: '#64748B', formatter: (v: any) => (typeof v === 'number' ? v.toLocaleString() : '') }}>
          {data.map((_, i) => (
            <Cell key={i} fill={SHADES[Math.min(i, SHADES.length - 1)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 2. HL Net theo tuần (weeklyHL[] của BC Tháng) ─────────────────────
export interface WeekRow { label: string; hlNet: number }
export function WeeklyChart({ data }: { data: WeekRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip content={<Tip />} />
        <Bar dataKey="hlNet" name="HL Net" fill={C.green} radius={[4, 4, 0, 0]} maxBarSize={48}
          label={{ position: 'top', fontSize: 11, fill: '#64748B', formatter: (v: any) => (typeof v === 'number' ? v.toLocaleString() : '') }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 3. UV theo thị trường (byThiTruong[] của BC Tháng) ───────────────
export interface MarketRow { label: string; uvNet: number; hlNet: number; trungNet: number }
export function MarketChart({ data }: { data: MarketRow[] }) {
  const top = data.slice(0, 8)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={top} margin={{ left: 0, right: 8, top: 4, bottom: 36 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} angle={-28} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip content={<Tip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="uvNet"    name="UV Net"    fill={C.blue}   radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Bar dataKey="hlNet"    name="HL Net"    fill={C.green}  radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Bar dataKey="trungNet" name="Trùng Net" fill={C.red}    radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 4. Xu hướng UV theo ngày (bang3[] của BC Ngày) ───────────────────
export interface DayRow { ngay: string; uvNet: number; hlNet: number; trungNet: number }
export function DailyTrendChart({ data }: { data: DayRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="ngay" tick={{ fontSize: 10, fill: '#64748B' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip content={<Tip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="uvNet"    name="UV Net"    stroke={C.blue}   strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="hlNet"    name="HL Net"    stroke={C.green}  strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="trungNet" name="Trùng Net" stroke={C.red}    strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── 5. Tổng quan 4 nhóm (tongQuan của BC Tổng) ───────────────────────
export interface GroupBar { label: string; val: number; color: string }

/** onBarClick: click vào 1 cột để xem drill-down chi tiết khu vực */
export function GroupTotalChart({
  data,
  onBarClick,
}: {
  data: GroupBar[]
  onBarClick?: (bar: GroupBar, index: number) => void
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip
          content={<Tip />}
          cursor={{ fill: 'rgba(148,163,184,0.12)' }}
        />
        <Bar
          dataKey="val"
          name="Tổng"
          radius={[6, 6, 0, 0]}
          maxBarSize={56}
          style={onBarClick ? { cursor: 'pointer' } : undefined}
          onClick={onBarClick ? (payload, index) => onBarClick(payload as GroupBar, index) : undefined}
          label={{
            position: 'top',
            fontSize: 12,
            fill: '#64748B',
            formatter: (v: any) => (typeof v === 'number' ? v.toLocaleString() : ''),
          }}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 6. Xu hướng theo tháng (byMonthNhap của BC Tổng) ─────────────────
export interface MonthTrendProps {
  months: number[]
  groups: { label: string; color: string; data: { month: number; val: number }[] }[]
}
export function MonthTrendChart({ months, groups }: MonthTrendProps) {
  const chartData = months.map(m => {
    const row: Record<string, unknown> = { label: `T${m}` }
    groups.forEach(g => { row[g.label] = g.data.find(r => r.month === m)?.val ?? 0 })
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip content={<Tip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {groups.map(g => (
          <Line key={g.label} type="monotone" dataKey={g.label} stroke={g.color} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
