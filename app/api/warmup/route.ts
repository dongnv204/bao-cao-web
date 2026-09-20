import { NextRequest, NextResponse } from 'next/server'
import { getTuyenDungReport, getBCThangReport, getBCTongReport } from '@/lib/sheets'

/**
 * API Warmup Cache — gọi tự động bởi cron mỗi 45 phút
 * Bảo vệ bằng CRON_SECRET để tránh lạm dụng
 *
 * GET /api/warmup?secret=<CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  // Kiểm tra secret key
  const secret = request.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now   = new Date()
  const day   = now.getDate()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const results = await Promise.allSettled([
    getTuyenDungReport(day, month, year),   // BC Ngày
    getBCThangReport(month, year),           // BC Tháng
    getBCTongReport(month, year),            // BC Tổng
  ])

  const status = {
    bcNgay:  results[0].status,
    bcThang: results[1].status,
    bcTong:  results[2].status,
    time:    new Date().toISOString(),
  }

  return NextResponse.json({ ok: true, ...status })
}
