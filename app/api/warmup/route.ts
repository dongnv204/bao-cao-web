import { NextRequest, NextResponse } from 'next/server'
import { getTuyenDungReport, getBCThangReport, getBCTongReport } from '@/lib/sheets'

/**
 * API Warmup Cache — gọi tự động bởi Vercel Cron mỗi 30 phút
 * Bảo vệ bằng CRON_SECRET (header Authorization hoặc ?secret= query param)
 *
 * GET /api/warmup?secret=<CRON_SECRET>
 * hoặc với header: Authorization: Bearer <CRON_SECRET>
 */
export const maxDuration = 30

export async function GET(request: NextRequest) {
  // Chấp nhận cả Authorization header (Vercel Cron) và ?secret= query param
  const authHeader = request.headers.get('authorization') || ''
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const querySecret  = request.nextUrl.searchParams.get('secret')
  const secret = bearerSecret || querySecret

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
