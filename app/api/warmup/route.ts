import { NextRequest, NextResponse } from 'next/server'
import { getTuyenDungReport, getBCThangReport, getBCTongReport } from '@/lib/sheets'
// [FIX 24/09/2026] Warm Supabase cache cho BC Ngày fallback
import { getCachedMonthRows } from '@/lib/supabase-candidates'

/**
 * API Warmup Cache — gọi tự động bởi Vercel Cron mỗi 30 phút
 * Bảo vệ bằng CRON_SECRET
 */
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const authHeader   = request.headers.get('authorization') || ''
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
    getTuyenDungReport(day, month, year),   // BC Ngày — Apps Script cache
    getBCThangReport(month, year),           // BC Tháng
    getBCTongReport(month, year),            // BC Tổng
    // [FIX 24/09/2026] Warm Supabase month bundle — fallback luôn < 50ms
    getCachedMonthRows(month, year),         // BC Ngày — Supabase cache
  ])

  const status = {
    bcNgay:         results[0].status,
    bcThang:        results[1].status,
    bcTong:         results[2].status,
    bcNgaySupabase: results[3].status,   // [MỚI]
    time:           new Date().toISOString(),
  }

  return NextResponse.json({ ok: true, ...status })
}
