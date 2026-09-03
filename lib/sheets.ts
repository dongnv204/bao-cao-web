// Lấy data từ Google Sheets qua Apps Script Web App URL
import { unstable_cache, revalidateTag } from 'next/cache'

const APPS_SCRIPT_URL          = process.env.APPS_SCRIPT_URL          || ''
const APPS_SCRIPT_URL_BC_THANG = process.env.APPS_SCRIPT_URL_BC_THANG || ''
const APPS_SCRIPT_URL_BC_TONG  = process.env.APPS_SCRIPT_URL_BC_TONG  || ''

// ── Raw fetch (không cache) — dùng nội bộ ────────────────────────────
async function _rawFetch(baseUrl: string, action: string, params?: Record<string, string>) {
  if (!baseUrl) throw new Error(`URL Apps Script chưa được cấu hình (action=${action})`)
  const url = new URL(baseUrl)
  url.searchParams.set('action', action)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Lỗi khi lấy dữ liệu: ${res.status}`)
  return res.json()
}

// ── BC Ngày — cache 5 phút, tag: bc-ngay ─────────────────────────────
export const getTuyenDungReport = unstable_cache(
  async (day: number, month: number, year: number) =>
    _rawFetch(APPS_SCRIPT_URL, 'tuyen-dung', {
      day: String(day), month: String(month), year: String(year),
    }),
  ['bc-ngay'],
  { revalidate: 300, tags: ['bc-ngay'] }
)

// ── BC Tháng — cache 15 phút, tag: bc-thang ──────────────────────────
export const getBCThangReport = unstable_cache(
  async (month: number, year: number) =>
    _rawFetch(APPS_SCRIPT_URL_BC_THANG, 'bc-thang', {
      month: String(month), year: String(year),
    }),
  ['bc-thang'],
  { revalidate: 900, tags: ['bc-thang'] }
)

// ── BC Tổng — cache 15 phút, tag: bc-tong ────────────────────────────
export const getBCTongReport = unstable_cache(
  async (month: number, year: number) =>
    _rawFetch(APPS_SCRIPT_URL_BC_TONG, 'bc-tong', {
      month: String(month), year: String(year),
    }),
  ['bc-tong'],
  { revalidate: 900, tags: ['bc-tong'] }
)

// ── Hàm xoá cache thủ công (dùng cho nút "Làm mới") ─────────────────
export function clearCacheBcNgay()   { revalidateTag('bc-ngay')  }
export function clearCacheBcThang()  { revalidateTag('bc-thang') }
export function clearCacheBcTong()   { revalidateTag('bc-tong')  }

// ── fetchReportData — giữ backward compat ────────────────────────────
export async function fetchReportData(reportType: string, params?: Record<string, string>) {
  return _rawFetch(APPS_SCRIPT_URL, reportType, params)
}
