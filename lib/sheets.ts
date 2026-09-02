// Lấy data từ Google Sheets qua Apps Script Web App URL
// Apps Script sẽ expose data dưới dạng JSON API

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || ''

// Gọi Apps Script API để lấy data báo cáo
export async function fetchReportData(
  reportType: string,
  params?: Record<string, string>
) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL chưa được cấu hình')
  }

  const url = new URL(APPS_SCRIPT_URL)
  url.searchParams.set('action', reportType)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const res = await fetch(url.toString(), {
    // Cache 5 phút để tránh gọi quá nhiều
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Lỗi khi lấy dữ liệu: ${res.status}`)
  }

  return res.json()
}

// Lấy báo cáo tuyển dụng theo ngày
export async function getTuyenDungReport(day: number, month: number, year: number) {
  return fetchReportData('tuyen-dung', {
    day: day.toString(),
    month: month.toString(),
    year: year.toString(),
  })
}
