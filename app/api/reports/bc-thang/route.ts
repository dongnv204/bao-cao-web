import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getBCThangReport } from '@/lib/sheets'

/**
 * GET /api/reports/bc-thang?month=M&year=YYYY
 *
 * Đọc BC Tháng từ Apps Script (data được pre-cache bởi refreshBCThang()
 * chạy mỗi giờ → phản hồi < 1s, không còn timeout 55s).
 */
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = Number(searchParams.get('month'))
  const year  = Number(searchParams.get('year'))

  if (!month || !year) {
    return NextResponse.json({ error: 'Thiếu tham số month hoặc year' }, { status: 400 })
  }

  try {
    const result = await getBCThangReport(month, year)

    if (!result || result.ok === false) {
      return NextResponse.json(
        { error: result?.error || 'Apps Script trả về lỗi' },
        { status: 502 }
      )
    }

    return NextResponse.json(result.data)
  } catch (err: any) {
    console.error('Lỗi gọi Apps Script BC Tháng:', err)
    return NextResponse.json(
      { error: err?.message || 'Không kết nối được Google Sheets' },
      { status: 500 }
    )
  }
}
