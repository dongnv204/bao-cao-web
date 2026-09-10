import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getStatsByDay, getStatsByMonth, getDailyListByMonth } from '@/lib/supabase-candidates'

/**
 * API BC Ngày — đọc từ Supabase (đã sync từ Google Sheets)
 *
 * GET /api/reports/bc-ngay?day=10&month=9&year=2026
 *   → stats ngày + stats tháng tính đến ngày đó + danh sách daily
 *
 * GET /api/reports/bc-ngay?month=9&year=2026
 *   → stats toàn tháng + danh sách daily
 */
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const day   = searchParams.get('day')   ? Number(searchParams.get('day'))   : undefined
  const month = Number(searchParams.get('month'))
  const year  = Number(searchParams.get('year'))

  if (!month || !year) {
    return NextResponse.json({ error: 'Thiếu tham số month/year' }, { status: 400 })
  }

  try {
    // Thống kê tháng (tính đến ngày nếu có)
    const statsThang = await getStatsByMonth(month, year, day)

    // Thống kê từng ngày trong tháng (cho biểu đồ trend)
    const dailyList  = await getDailyListByMonth(month, year)

    // Thống kê ngày hôm nay (nếu có day param)
    const statsNgay  = day ? await getStatsByDay(day, month, year) : null

    return NextResponse.json({
      ok: true,
      data: {
        // Metadata
        day, month, year,
        // Tháng tích lũy
        thang: statsThang,
        // Ngày hôm nay
        ngay: statsNgay,
        // Danh sách ngày (biểu đồ)
        dailyList,
      },
    })
  } catch (err: any) {
    console.error('Lỗi BC Ngày Supabase:', err)
    return NextResponse.json(
      { error: err?.message || 'Lỗi kết nối Supabase' },
      { status: 500 }
    )
  }
}
