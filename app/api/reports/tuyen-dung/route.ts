import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getTuyenDungReport } from '@/lib/sheets'
import { getMonthBundle, CandidateStats } from '@/lib/supabase-candidates'

// Cho phép Vercel chạy function tối đa 30 giây (thay vì default 10s)
export const maxDuration = 30

// ── Helper: dùng chung với bc-test ───────────────────────────────────────────
function statsToFields(s: CandidateStats) {
  const tyLeHl   = (s.hopLe + s.trung) > 0 ? s.hopLe / (s.hopLe + s.trung) * 100 : null
  const pctHaoHut = s.formNhap > 0 ? (s.formNhap - s.uvNet) / s.formNhap * 100 : null
  return { ...s, tyLeHl, pctHaoHut, hlNet: s.hopLe, trungNet: s.trung }
}

function thuVi(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
}

/**
 * Tạo data fallback từ Supabase (nhanh < 1s) khi Apps Script chưa phản hồi.
 * Format giống y hệt tuyen-dung nhưng bang4 = [] và các trường PV/HĐ/Duyệt = 0.
 */
async function buildSupabaseFallback(day: number, month: number, year: number) {
  const { statsThang, statsNgay, dailyList } = await getMonthBundle(month, year, day)

  const sThang = statsToFields(statsThang)
  const sNgay  = statsNgay
    ? statsToFields(statsNgay)
    : statsToFields({ formNhap: 0, hopLe: 0, trung: 0, chuaCheck: 0, uvNet: 0, byRecruiter: [] })

  // bang1 — thiếu dauPV/kyHD/duyet (chỉ có trong Google Sheets), để undefined
  const bang1 = {
    formNhapThang:    sThang.formNhap,
    targetFormThang:  0,
    uvLocThang:       sThang.formNhap,
    targetUvLocThang: 0,
    uvNetThang:       sThang.uvNet,
    targetUvNetThang: 0,
    hlNetThang:       sThang.hlNet,
    targetHlNetThang: 0,
    trungNetThang:    sThang.trungNet,
    targetTrungThang: 0,
    tyLeHlThang:      sThang.tyLeHl,
    chuaCheckThang:   sThang.chuaCheck,
    formNhapNgay:    sNgay.formNhap,
    targetFormNgay:  0,
    uvLocNgay:       sNgay.formNhap,
    uvNetNgay:       sNgay.uvNet,
    targetUvNetNgay: 0,
    hlNetNgay:       sNgay.hlNet,
    targetHlNetNgay: 0,
    trungNetNgay:    sNgay.trungNet,
    targetTrungNgay: 0,
    hlThoNgay:       sNgay.hlNet,
    trungThoNgay:    sNgay.trungNet,
  }

  // bang2
  const nguon = (sNgay.byRecruiter || [])
    .map(r => {
      const tyLeHl = (r.hopLe + r.trung) > 0 ? r.hopLe / (r.hopLe + r.trung) * 100 : null
      return { ten: r.recruiter, uvNet: r.uvNet, hlNet: r.hopLe, trungNet: r.trung, tyLeHl, chuaCheck: 0 }
    })
    .sort((a, b) => b.uvNet - a.uvNet)

  const bang2 = {
    tho: {
      formNhap:       sNgay.formNhap,
      targetFormNgay: 0,
      uvLoc:          sNgay.formNhap,
      hlTho:          sNgay.hlNet,
      pctHlTho:       sNgay.formNhap > 0 ? sNgay.hlNet / sNgay.formNhap * 100 : null,
      trungTho:       sNgay.trungNet,
      pctTrungTho:    sNgay.formNhap > 0 ? sNgay.trungNet / sNgay.formNhap * 100 : null,
      chuaCheck:      sNgay.chuaCheck,
    },
    net: {
      uvNet:           sNgay.uvNet,
      targetUvNetNgay: 0,
      hlNet:           sNgay.hlNet,
      targetHlNetNgay: 0,
      trungNet:        sNgay.trungNet,
      targetTrungNgay: 0,
      tyLeHl:          sNgay.tyLeHl,
    },
    nguon,
    phanLoai: [],
  }

  // bang3 — từng ngày trong tháng
  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const bang3Rows = dailyList.map(({ ngay: ngayStr, stats }) => {
    const sf = statsToFields(stats)
    const d  = new Date(ngayStr + 'T00:00:00')
    return {
      ngay:       `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,
      thu:        thuVi(ngayStr),
      formNhap:   sf.formNhap,
      uvLoc:      sf.formNhap,
      pctHaoHut:  sf.pctHaoHut,
      uvNet:      sf.uvNet,
      hlNet:      sf.hlNet,
      trungNet:   sf.trungNet,
      chuaCheck:  sf.chuaCheck,
      pctHl:      sf.tyLeHl,
      isSelected: ngayStr === dateStr,
    }
  })

  const sTotal = statsToFields(statsThang)
  const totalRow = {
    ngay: 'Tổng', thu: '—',
    formNhap: sTotal.formNhap, uvLoc: sTotal.formNhap,
    pctHaoHut: sTotal.pctHaoHut, uvNet: sTotal.uvNet,
    hlNet: sTotal.hlNet, trungNet: sTotal.trungNet,
    chuaCheck: sTotal.chuaCheck, pctHl: sTotal.tyLeHl,
    isTotal: true,
  }

  return {
    day, month, year,
    bang1, bang2,
    bang3: [...bang3Rows, totalRow],
    bang4: [],        // Google Sheets only — không có trong Supabase
    _source: 'supabase',  // Flag để client biết đây là dữ liệu tạm
  }
}

// ── GET /api/reports/tuyen-dung?day=D&month=M&year=YYYY ──────────────────────
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const day   = Number(searchParams.get('day'))
  const month = Number(searchParams.get('month'))
  const year  = Number(searchParams.get('year'))

  if (!day || !month || !year) {
    return NextResponse.json({ error: 'Thiếu tham số ngày/tháng/năm' }, { status: 400 })
  }

  // Thử Apps Script với timeout 25 giây.
  // Nếu vẫn timeout sau 25s, trả Supabase fallback để user thấy dữ liệu tạm thời.
  const TIMEOUT_MS = 25000

  try {
    const result = await Promise.race([
      getTuyenDungReport(day, month, year),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('apps_script_timeout')), TIMEOUT_MS)
      ),
    ])

    // Apps Script trả lỗi hoặc OK = false
    if (!result || result.ok === false) {
      console.warn('Apps Script trả về lỗi, dùng Supabase fallback')
      const fallback = await buildSupabaseFallback(day, month, year)
      return NextResponse.json(fallback)
    }

    // Thành công — trả đầy đủ dữ liệu Google Sheets
    return NextResponse.json(result.data)

  } catch (err: any) {
    if (err?.message === 'apps_script_timeout') {
      // Apps Script chưa warm — dùng Supabase để trả ngay
      console.warn(`Apps Script timeout >${TIMEOUT_MS}ms, dùng Supabase fallback`)
      try {
        const fallback = await buildSupabaseFallback(day, month, year)
        return NextResponse.json(fallback)
      } catch (sbErr: any) {
        console.error('Supabase fallback cũng lỗi:', sbErr)
        return NextResponse.json({ error: 'Không lấy được dữ liệu từ cả Apps Script lẫn Supabase' }, { status: 503 })
      }
    }

    // Lỗi khác (mạng, parse, v.v.)
    console.error('Lỗi gọi Apps Script:', err)
    try {
      const fallback = await buildSupabaseFallback(day, month, year)
      return NextResponse.json(fallback)
    } catch {
      return NextResponse.json({ error: err?.message || 'Không kết nối được Google Sheets' }, { status: 500 })
    }
  }
}
