// Lấy data từ Google Sheets qua Apps Script Web App URL

const APPS_SCRIPT_URL          = process.env.APPS_SCRIPT_URL          || ''
const APPS_SCRIPT_URL_BC_THANG = process.env.APPS_SCRIPT_URL_BC_THANG || ''
const APPS_SCRIPT_URL_BC_TONG  = process.env.APPS_SCRIPT_URL_BC_TONG  || ''

// ── Gọi Apps Script URL bất kỳ ──────────────────────────────────────
async function _fetchFromScript(baseUrl: string, action: string, params?: Record<string, string>) {
  if (!baseUrl) throw new Error(`URL Apps Script chưa được cấu hình (action=${action})`)
  const url = new URL(baseUrl)
  url.searchParams.set('action', action)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Lỗi khi lấy dữ liệu: ${res.status}`)
  return res.json()
}

// ── BC Tuyển Dụng (báo cáo ngày) ────────────────────────────────────
export async function fetchReportData(reportType: string, params?: Record<string, string>) {
  return _fetchFromScript(APPS_SCRIPT_URL, reportType, params)
}
export async function getTuyenDungReport(day: number, month: number, year: number) {
  return fetchReportData('tuyen-dung', {
    day: day.toString(), month: month.toString(), year: year.toString(),
  })
}

// ── BC Tháng tuyển dụng ──────────────────────────────────────────────
export async function getBCThangReport(month: number, year: number) {
  return _fetchFromScript(APPS_SCRIPT_URL_BC_THANG, 'bc-thang', {
    month: month.toString(), year: year.toString(),
  })
}

// ── BC Tổng (đậu PV / đào tạo / ký HĐ / duyệt) ─────────────────────
export async function getBCTongReport(month: number, year: number) {
  return _fetchFromScript(APPS_SCRIPT_URL_BC_TONG, 'bc-tong', {
    month: month.toString(), year: year.toString(),
  })
}
