/**
 * supabase-candidates.ts
 * Hàm query từ bảng candidates trong Supabase
 * Dùng cho BC Ngày
 *
 * [FIX 24/09/2026] Thêm unstable_cache để cache month bundle — tốc độ ~50ms thay vì 200-600ms
 * [FIX 24/09/2026] Thêm phan_loai vào SELECT và CandidateStats
 */
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// Dùng service role key để bypass RLS
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── Row type từ Supabase ──────────────────────────────────────────────────────
type CandidateRow = {
  ngay_nhap:  string
  check_sdt:  string | null
  trang_thai: string | null
  phan_loai:  string | null   // [THÊM MỚI] Phân loại UV
  recruiter:  string | null
}

// ── CandidateStats interface ─────────────────────────────────────────────────
export interface CandidateStats {
  formNhap:  number          // Tổng UV nhập
  hopLe:     number          // Check SĐT = Hợp lệ
  trung:     number          // Check SĐT = Trùng
  chuaCheck: number          // Chưa check SĐT
  uvNet:     number          // UV đạt (không trùng, không bị loại)
  /** [THÊM MỚI] Thống kê theo phân loại (kênh nguồn) */
  phanLoaiBreakdown: { label: string; count: number }[]
  byRecruiter: {
    recruiter: string
    formNhap:  number
    hopLe:     number
    trung:     number
    uvNet:     number
  }[]
}

// ── Tính stats từ mảng candidates ────────────────────────────────────────────
function computeStats(rows: CandidateRow[]): CandidateStats {
  const isHopLe = (v: string | null) =>
    !!v && v.trim() !== '' && v.toLowerCase().includes('h\u1ee3p l\u1ec7')
  const isTrung = (v: string | null) =>
    !!v && v.toLowerCase().includes('tr\u00f9ng')
  // UV Net = không trùng VÀ trạng thái không bị loại
  const isNet = (row: CandidateRow) => {
    if (isTrung(row.check_sdt)) return false
    const tt = (row.trang_thai || '').toLowerCase()
    if (tt.includes('lo\u1ea1i') || tt.includes('t\u1eeb ch\u1ed1i') || tt.includes('kh\u00f4ng \u0111\u1ea1t')) return false
    return true
  }

  const formNhap  = rows.length
  const hopLe     = rows.filter(r => isHopLe(r.check_sdt)).length
  const trung     = rows.filter(r => isTrung(r.check_sdt)).length
  const chuaCheck = rows.filter(r => !r.check_sdt || r.check_sdt.trim() === '').length
  const uvNet     = rows.filter(r => isNet(r)).length

  // [THÊM MỚI] Group theo phan_loai
  const plMap: Record<string, number> = {}
  rows.forEach(r => {
    const key = (r.phan_loai || '').trim() || '(Ch\u01b0a ph\u00e2n lo\u1ea1i)'
    plMap[key] = (plMap[key] || 0) + 1
  })
  const phanLoaiBreakdown = Object.entries(plMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  // Group theo recruiter
  const recruiters: Record<string, CandidateRow[]> = {}
  rows.forEach(r => {
    const key = r.recruiter || 'Kh\u00e1c'
    if (!recruiters[key]) recruiters[key] = []
    recruiters[key].push(r)
  })
  const byRecruiter = Object.entries(recruiters).map(([recruiter, list]) => ({
    recruiter,
    formNhap: list.length,
    hopLe:    list.filter(r => isHopLe(r.check_sdt)).length,
    trung:    list.filter(r => isTrung(r.check_sdt)).length,
    uvNet:    list.filter(r => isNet(r)).length,
  }))

  return { formNhap, hopLe, trung, chuaCheck, uvNet, phanLoaiBreakdown, byRecruiter }
}

// ── [CORE] Raw fetch — không cache, chỉ dùng nội bộ ─────────────────────────
async function _fetchMonthRows(month: number, year: number): Promise<CandidateRow[]> {
  const supabase  = getSupabase()
  const mm        = String(month).padStart(2, '0')
  const startDate = `${year}-${mm}-01`
  const lastDay   = new Date(year, month, 0).getDate()
  const endDate   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('candidates')
    .select('ngay_nhap, check_sdt, trang_thai, phan_loai, recruiter')
    .gte('ngay_nhap', startDate)
    .lte('ngay_nhap', endDate)
    .order('ngay_nhap')

  if (error) throw new Error(`Supabase error: ${error.message}`)
  return (data || []) as CandidateRow[]
}

// ── [FIX - TIER 1] Cache month rows per (month, year) — TTL 5 phút ───────────
export const getCachedMonthRows = unstable_cache(
  _fetchMonthRows,
  ['bc-ngay-month-rows'],
  {
    revalidate: 300,
    tags: ['bc-ngay'],
  }
)

// ── Lấy bundle month data với CACHE ──────────────────────────────────────────
export async function getMonthBundle(
  month: number,
  year:  number,
  day?:  number
): Promise<{
  statsThang: CandidateStats
  statsNgay:  CandidateStats | null
  dailyList:  { ngay: string; stats: CandidateStats }[]
}> {
  const rows = await getCachedMonthRows(month, year)
  const mm = String(month).padStart(2, '0')

  const byDay: Record<string, CandidateRow[]> = {}
  rows.forEach(row => {
    if (!byDay[row.ngay_nhap]) byDay[row.ngay_nhap] = []
    byDay[row.ngay_nhap].push(row)
  })

  const dayStr    = day ? `${year}-${mm}-${String(day).padStart(2, '0')}` : null
  const rowsThang = dayStr ? rows.filter(r => r.ngay_nhap <= dayStr) : rows
  const statsThang = computeStats(rowsThang)
  const statsNgay  = dayStr ? computeStats(byDay[dayStr] || []) : null
  const dailyList  = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ngay, dayRows]) => ({ ngay, stats: computeStats(dayRows) }))

  return { statsThang, statsNgay, dailyList }
}

// ── Legacy functions ──────────────────────────────────────────────────────────

export async function getStatsByDay(
  day: number, month: number, year: number
): Promise<CandidateStats> {
  const rows    = await getCachedMonthRows(month, year)
  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  return computeStats(rows.filter(r => r.ngay_nhap === dateStr))
}

export async function getStatsByMonth(
  month: number, year: number, upToDay?: number
): Promise<CandidateStats> {
  const rows = await getCachedMonthRows(month, year)
  if (upToDay) {
    const end = `${year}-${String(month).padStart(2,'0')}-${String(upToDay).padStart(2,'0')}`
    return computeStats(rows.filter(r => r.ngay_nhap <= end))
  }
  return computeStats(rows)
}

export async function getDailyListByMonth(
  month: number, year: number
): Promise<{ ngay: string; stats: CandidateStats }[]> {
  const rows = await getCachedMonthRows(month, year)
  const byDay: Record<string, CandidateRow[]> = {}
  rows.forEach(r => {
    if (!byDay[r.ngay_nhap]) byDay[r.ngay_nhap] = []
    byDay[r.ngay_nhap].push(r)
  })
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ngay, dayRows]) => ({ ngay, stats: computeStats(dayRows) }))
}
