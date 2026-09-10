/**
 * supabase-candidates.ts
 * Hàm query từ bảng candidates trong Supabase
 * Dùng cho BC Ngày và BC Tháng
 */
import { createClient } from '@supabase/supabase-js'

// Dùng service role key để bypass RLS
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface CandidateStats {
  formNhap: number      // Tổng UV nhập
  hopLe: number         // Check SĐT = Hợp lệ
  trung: number         // Check SĐT = Trùng
  chuaCheck: number     // Chưa check SĐT
  uvNet: number         // UV đạt (đã lọc hợp lệ, không trùng)
  byRecruiter: {
    recruiter: string
    formNhap: number
    hopLe: number
    trung: number
    uvNet: number
  }[]
}

/**
 * Thống kê theo một ngày cụ thể
 */
export async function getStatsByDay(
  day: number, month: number, year: number
): Promise<CandidateStats> {
  const supabase = getSupabase()
  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  const { data, error } = await supabase
    .from('candidates')
    .select('check_sdt, trang_thai, recruiter')
    .eq('ngay_nhap', dateStr)

  if (error) throw new Error(`Supabase error: ${error.message}`)
  return computeStats(data || [])
}

/**
 * Thống kê theo tháng (từ đầu tháng đến ngày hiện tại hoặc cuối tháng)
 */
export async function getStatsByMonth(
  month: number, year: number, upToDay?: number
): Promise<CandidateStats> {
  const supabase = getSupabase()
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`
  let endDate: string

  if (upToDay) {
    endDate = `${year}-${String(month).padStart(2,'0')}-${String(upToDay).padStart(2,'0')}`
  } else {
    // Cuối tháng
    const lastDay = new Date(year, month, 0).getDate()
    endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
  }

  const { data, error } = await supabase
    .from('candidates')
    .select('check_sdt, trang_thai, recruiter')
    .gte('ngay_nhap', startDate)
    .lte('ngay_nhap', endDate)

  if (error) throw new Error(`Supabase error: ${error.message}`)
  return computeStats(data || [])
}

/**
 * Danh sách thống kê từng ngày trong tháng
 */
export async function getDailyListByMonth(
  month: number, year: number
): Promise<{ ngay: string; stats: CandidateStats }[]> {
  const supabase = getSupabase()
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

  const { data, error } = await supabase
    .from('candidates')
    .select('ngay_nhap, check_sdt, trang_thai, recruiter')
    .gte('ngay_nhap', startDate)
    .lte('ngay_nhap', endDate)
    .order('ngay_nhap')

  if (error) throw new Error(`Supabase error: ${error.message}`)

  // Group theo ngày
  const byDay: Record<string, typeof data> = {}
  ;(data || []).forEach(row => {
    if (!byDay[row.ngay_nhap]) byDay[row.ngay_nhap] = []
    byDay[row.ngay_nhap].push(row)
  })

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ngay, rows]) => ({ ngay, stats: computeStats(rows!) }))
}

/**
 * Tính toán stats từ mảng candidates
 */
function computeStats(rows: { check_sdt: string; trang_thai: string; recruiter: string }[]): CandidateStats {
  const isHopLe = (v: string) =>
    !v || v.trim() === '' || v.toLowerCase().includes('hợp lệ')
  const isTrung = (v: string) =>
    v.toLowerCase().includes('trùng')
  // UV Net = không trùng VÀ trạng thái không bị loại
  const isNet = (row: { check_sdt: string; trang_thai: string }) => {
    if (isTrung(row.check_sdt || '')) return false
    const tt = (row.trang_thai || '').toLowerCase()
    if (tt.includes('loại') || tt.includes('từ chối') || tt.includes('không đạt')) return false
    return true
  }

  const formNhap  = rows.length
  const hopLe     = rows.filter(r => isHopLe(r.check_sdt || '')).length
  const trung     = rows.filter(r => isTrung(r.check_sdt || '')).length
  const chuaCheck = rows.filter(r => !r.check_sdt || r.check_sdt.trim() === '').length
  const uvNet     = rows.filter(r => isNet(r)).length

  // Group theo recruiter
  const recruiters: Record<string, typeof rows> = {}
  rows.forEach(r => {
    const key = r.recruiter || 'Khác'
    if (!recruiters[key]) recruiters[key] = []
    recruiters[key].push(r)
  })

  const byRecruiter = Object.entries(recruiters).map(([recruiter, list]) => ({
    recruiter,
    formNhap: list.length,
    hopLe:    list.filter(r => isHopLe(r.check_sdt || '')).length,
    trung:    list.filter(r => isTrung(r.check_sdt || '')).length,
    uvNet:    list.filter(r => isNet(r)).length,
  }))

  return { formNhap, hopLe, trung, chuaCheck, uvNet, byRecruiter }
}
