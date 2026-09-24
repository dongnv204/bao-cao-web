import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getBCThangReport } from '@/lib/sheets'
import { getStatsByMonth, getDailyListByMonth } from '@/lib/supabase-candidates'

// Cho phép Vercel chạy function tối đa 60 giây (max Hobby plan)
export const maxDuration = 60

const TIMEOUT_MS = 55000

/**
 * Tạo data fallback từ Supabase khi Apps Script timeout.
 * Chỉ có dữ liệu cơ bản (UV nhập, HL/Trùng thô, weekly HL).
 * Các trường PV/HĐ/Duyệt không có trong Supabase → để 0.
 */
async function buildSupabaseFallback(month: number, year: number) {
  const [stats, dailyList] = await Promise.all([
    getStatsByMonth(month, year),
    getDailyListByMonth(month, year),
  ])

  const tongQuan = {
    tongUVNhap: stats.formNhap,
    hopLeTho:   stats.hopLe,
    trungTho:   stats.trung,
    chuaCheck:  stats.chuaCheck,
    hlNet:      stats.hopLe,
    trungNet:   stats.trung,
    tongUVNet:  stats.uvNet,
    // Google Sheets only — để 0
    kyHDTotal: 0, kyHD: 0, duyet: 0, daoTao: 0, dauPV: 0,
    coLich: 0, baoLich: 0, chuaCo: 0, khac: 0,
    hlLan2: 0, trungLan2: 0,
  }

  // Weekly HL Net — tính từ dailyList
  const weeklyHLMap: Record<number, { hlNet: number; days: string[] }> = {}
  dailyList.forEach(({ ngay, stats: s }) => {
    const dayOfMonth = new Date(ngay + 'T00:00:00').getDate() - 1
    const w = Math.floor(dayOfMonth / 7) + 1
    if (!weeklyHLMap[w]) weeklyHLMap[w] = { hlNet: 0, days: [] }
    weeklyHLMap[w].hlNet += s.hopLe
    weeklyHLMap[w].days.push(ngay)
  })

  const weeklyHL = Object.entries(weeklyHLMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, { hlNet, days }]) => {
      const fmt = (d: string) => d.slice(8, 10) + '/' + String(month).padStart(2, '0')
      const label = days.length > 1
        ? `${fmt(days[0])}–${fmt(days[days.length - 1])}`
        : fmt(days[0])
      return { week: Number(week), label, hlNet }
    })

  const updatedAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

  return {
    month, year, updatedAt,
    empty: stats.formNhap === 0,
    message: stats.formNhap === 0 ? `Tháng ${month}/${year} chưa có dữ liệu` : undefined,
    tongQuan,
    weeklyHL,
    pheu:          undefined,
    trangThaiList: undefined,
    phanLoaiList:  undefined,
    byThiTruong:   undefined,
    _source: 'supabase', // Flag để client biết đây là dữ liệu tạm
  }
}

// ── GET /api/reports/bc-thang?month=M&year=YYYY ──────────────────────
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
    const result = await Promise.race([
      getBCThangReport(month, year),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('apps_script_timeout')), TIMEOUT_MS)
      ),
    ])

    // Apps Script trả về lỗi → dùng Supabase fallback
    if (!result || result.ok === false) {
      console.warn('BC Tháng Apps Script lỗi, dùng Supabase fallback')
      const fallback = await buildSupabaseFallback(month, year)
      return NextResponse.json(fallback)
    }

    return NextResponse.json(result.data)

  } catch (err: any) {
    if (err?.message === 'apps_script_timeout') {
      // Timeout → dùng Supabase để user không phải chờ
      console.warn(`BC Tháng Apps Script timeout >${TIMEOUT_MS}ms, dùng Supabase fallback`)
      try {
        const fallback = await buildSupabaseFallback(month, year)
        return NextResponse.json(fallback)
      } catch (sbErr: any) {
        console.error('Supabase fallback cũng lỗi:', sbErr)
        return NextResponse.json(
          { error: 'Không lấy được dữ liệu từ cả Apps Script lẫn Supabase' },
          { status: 503 }
        )
      }
    }

    // Lỗi khác (mạng, parse, ...) → thử Supabase fallback
    console.error('Lỗi gọi Apps Script BC Tháng:', err)
    try {
      const fallback = await buildSupabaseFallback(month, year)
      return NextResponse.json(fallback)
    } catch {
      return NextResponse.json(
        { error: err?.message || 'Không kết nối được Google Sheets' },
        { status: 500 }
      )
    }
  }
}
