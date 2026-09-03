// Lấy data từ Google Sheets qua Apps Script Web App URL
// Apps Script expose data dưới dạng JSON API

const APPS_SCRIPT_URL          = process.env.APPS_SCRIPT_URL          || ''
const APPS_SCRIPT_URL_BC_THANG = process.env.APPS_SCRIPT_URL_BC_THANG || ''

// ── Gọi Apps Script URL bất kỳ với action + params ──────────────────
async function _fetchFromScript(baseUrl: string, action: string, params?: Record<string, string>) {
  if (!baseUrl) throw new Error(`URL Apps Script chưa được cấu hình (action=${action})`)

  const url = new URL(baseUrl)
  url.searchParams.set('action', action)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    // Cache 5 phút để tránh gọi quá nhiều
    next: { revalidate: 300 },
  })

  if (!res.ok) throw new Error(`Lỗi khi lấy dữ liệu: ${res.status}`)
  return res.json()
}

// ── BC Tuyển Dụng (báo cáo ngày) ────────────────────────────────────
export async function fetchReportData(reportType: string, params?: Record<string, string>) {
  return _fetchFromScript(APPS_SCRIPT_URL, reportType, params)
}

export async function getTuyenDungReport(day: number, month: number, year: number) {
  return fetchReportData('tuyen-dung', {
    day:   day.toString(),
    month: month.toString(),
    year:  year.toString(),
  })
}

// ── BC Tháng (báo cáo tháng tuyển dụng) ─────────────────────────────
export async function getBCThangReport(month: number, year: number) {
  return _fetchFromScript(APPS_SCRIPT_URL_BC_THANG, 'bc-thang', {
    month: month.toString(),
    year:  year.toString(),
  })
}
