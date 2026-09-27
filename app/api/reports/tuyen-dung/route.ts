import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getTuyenDungReport } from '@/lib/sheets'
import { getMonthBundle, CandidateStats } from '@/lib/supabase-candidates'

// Cho phép Vercel chạy function tối đa 60 giây
export const maxDuration = 60

// ── Helper ───────────────────────────────────────────────────────────────────
function statsToFields(s: CandidateStats) {
  const tyLeHl    = (s.hopLe + s.trung) > 0 ? s.hopLe / (s.hopLe + s.trung) * 100 : null
  const pctHaoHut = s.formNhap > 0 ? (s.formNhap - s.uvNet) / s.formNhap * 100 : null
  return { ...s, tyLeHl, pctHaoHut, hlNet: s.hopLe, trungNet: s.trung }
}

function thuVi(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
}

/**
 * Tạo data từ Supabase (nhanh ~50ms với cache) khi Apps Script chưa phản hồi.
 * [FIX 24/09/2026] getMonthBundle dùng unstable_cache — luôn ~50ms
 * [FIX 24/09/2026] bang2.phanLoai populate từ phanLoaiBreakdown
 */
async function buildSupabaseFallback(day: number, month: number, year: number) {
  const { statsThang, statsNgay, dailyList } = await getMonthBundle(month, year, day)

  const sThang = statsToFields(statsThang)
  const sNgay  = statsNgay
    ? statsToFields(statsNgay)
    : statsToFields({ formNhap: 0, hopLe: 0, trung: 0, chuaCheck: 0, uvNet: 0, phanLoaiBreakdown: [], byRecruiter: [] })

  // bang1
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
    hlThoThang:       sThang.hopLe,
    trungThoThang:    sThang.trung,
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

  // bang2 — nguon = by recruiter
  const nguon = (sNgay.byRecruiter || [])
    .map(r => {
      const tyLeHl = (r.hopLe + r.trung) > 0 ? r.hopLe / (r.hopLe + r.trung) * 100 : null
      return { ten: r.recruiter, uvNet: r.uvNet, hlNet: r.hopLe, trungNet: r.trung, tyLeHl, chuaCheck: 0 }
    })
    .sort((a, b) => b.uvNet - a.uvNet)

  // [FIX 24/09/2026] Populate phanLoai từ phanLoaiBreakdown — trước đây hardcode []
  const phanLoai = (sNgay.phanLoaiBreakdown || [])
    .filter(p => p.label !== '(Ch\u01b0a ph\u00e2n lo\u1ea1i)' && p.count > 0)
    .map(p => ({ ten: p.label, soLuong: p.count }))

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
    phanLoai,   // [FIX] Thực tế thay vì []
  }

  // bang3 — từng ngày
  const dateStr   = year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0')
  const bang3Rows = dailyList.map(({ ngay: ngayStr, stats }) => {
    const sf = statsToFields(stats)
    const d  = new Date(ngayStr + 'T00:00:00')
    return {
      ngay:       String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'),
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

  const sTotal   = statsToFields(statsThang)
  const totalRow = {
    ngay: 'T\u1ed5ng', thu: '\u2014',
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
    bang4: [],
    _source: 'supabase',
  }
}

// ── GET /api/reports/tuyen-dung?day=D&month=M&year=YYYY ──────────────────────
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Ch\u01b0a \u0111\u0103ng nh\u1eadp' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const day   = Number(searchParams.get('day'))
  const month = Number(searchParams.get('month'))
  const year  = Number(searchParams.get('year'))

  if (!day || !month || !year) {
    return NextResponse.json({ error: 'Thi\u1ebfu tham s\u1ed1 ng\u00e0y/th\u00e1ng/n\u0103m' }, { status: 400 })
  }

  // [FIX 24/09/2026] Gi\u1ea3m timeout t\u1eeb 55s -> 10s.
  // Supabase fallback gi\u1edd d\u00f9ng cache (< 50ms), kh\u00f4ng c\u1ea7n ch\u1edd Apps Script l\u00e2u.
  const TIMEOUT_MS = 10_000

  try {
    const result = await Promise.race([
      getTuyenDungReport(day, month, year),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('apps_script_timeout')), TIMEOUT_MS)
      ),
    ])

    if (!result || result.ok === false) {
      const fallback = await buildSupabaseFallback(day, month, year)
      return NextResponse.json(fallback)
    }

    return NextResponse.json(result.data)

  } catch (err: any) {
    if (err?.message === 'apps_script_timeout') {
      try {
        const fallback = await buildSupabaseFallback(day, month, year)
        return NextResponse.json(fallback)
      } catch (sbErr: any) {
        return NextResponse.json(
          { error: 'Kh\u00f4ng l\u1ea5y \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u t\u1eeb c\u1ea3 Apps Script l\u1eabn Supabase' },
          { status: 503 }
        )
      }
    }

    try {
      const fallback = await buildSupabaseFallback(day, month, year)
      return NextResponse.json(fallback)
    } catch {
      return NextResponse.json(
        { error: err?.message || 'L\u1ed7i k\u1ebft n\u1ed1i' },
        { status: 500 }
      )
    }
  }
}
