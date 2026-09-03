import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getTuyenDungReport } from '@/lib/sheets'

// API route: lấy báo cáo tuyển dụng theo ngày từ Google Sheets (qua Apps Script)
// Yêu cầu: đã đăng nhập (kiểm tra session cookie)
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const day = Number(searchParams.get('day'))
  const month = Number(searchParams.get('month'))
  const year = Number(searchParams.get('year'))

  if (!day || !month || !year) {
    return NextResponse.json({ error: 'Thiếu tham số ngày/tháng/năm' }, { status: 400 })
  }

  try {
    const result = await getTuyenDungReport(day, month, year)

    // Apps Script trả { ok: true, data } hoặc { ok: false, error }
    if (!result || result.ok === false) {
      return NextResponse.json(
        { error: result?.error || 'Apps Script trả về lỗi' },
        { status: 502 }
      )
    }

    return NextResponse.json(result.data)
  } catch (err: any) {
    console.error('Lỗi gọi Apps Script:', err)
    return NextResponse.json(
      { error: err?.message || 'Không kết nối được Google Sheets' },
      { status: 500 }
    )
  }
}
