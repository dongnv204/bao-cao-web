import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getMonthBundle, CandidateStats } from '@/lib/supabase-candidates'

// API BC Test — dùng getMonthBundle từ supabase-candidates (tránh duplicate Supabase query)
// Trả về cùng format với BC Ngày (bang1/bang2/bang3)

function thuVi(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
}

// Ánh xạ CandidateStats → các trường bang1/bang2
function statsToFields(s: CandidateStats) {
  const tyLeHl = (s.hopLe + s.trung) > 0 ? s.hopLe / (s.hopLe + s.trung) * 100 : null
  const pctHaoHut = s.formNhap > 0 ? (s.formNhap - s.uvNet) / s.formNhap * 100 : null
  return { ...s, tyLeHl, pctHaoHut, hlNet: s.hopLe, trungNet: s.trung }
}

// ── GET /api/reports/bc-test?day=10&month=9&year=2026 ────────────────────────
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const day   = searchParams.get('day') ? Number(searchParams.get('day')) : undefined
  const month = Number(searchParams.get('month'))
  const year  = Number(searchParams.get('year'))

  if (!month || !year) {
    return NextResponse.json({ error: 'Thiếu tham số month/year' }, { status: 400 })
  }

  try {
    // 1 query lấy toàn bộ tháng từ hàm dùng chung
    const currentDay = day ?? new Date().getDate()
    const { statsThang, statsNgay, dailyList } = await getMonthBundle(month, year, currentDay)

    const sThang = statsToFields(statsThang)
    const sNgay  = statsNgay ? statsToFields(statsNgay) : statsToFields({ formNhap: 0, hopLe: 0, trung: 0, chuaCheck: 0, uvNet: 0, byRecruiter: [] , phanLoaiBreakdown: []})

    // ── BẢNG 1 ─────────────────────────────────────────────────────────────────
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

    // ── BẢNG 2 ─────────────────────────────────────────────────────────────────
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
    }

    // ── BẢNG 3 — mỗi ngày trong tháng ────────────────────────────────────────
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`
    const bang3Rows = dailyList.map(({ ngay: ngayStr, stats }) => {
      const sf = statsToFields(stats)
      const d  = new Date(ngayStr + 'T00:00:00')
      return {
        ngay:       `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
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

    // Dòng tổng
    const sTotal = statsToFields(statsThang)
    const totalRow = {
      ngay:      'Tổng',
      thu:       '—',
      formNhap:  sTotal.formNhap,
      uvLoc:     sTotal.formNhap,
      pctHaoHut: sTotal.pctHaoHut,
      uvNet:     sTotal.uvNet,
      hlNet:     sTotal.hlNet,
      trungNet:  sTotal.trungNet,
      chuaCheck: sTotal.chuaCheck,
      pctHl:     sTotal.tyLeHl,
      isTotal:   true,
    }

    return NextResponse.json({
      day: currentDay,
      month,
      year,
      bang1,
      bang2,
      bang3: [...bang3Rows, totalRow],
    })

  } catch (err: any) {
    console.error('Lỗi BC Test Supabase:', err)
    return NextResponse.json(
      { error: err?.message || 'Lỗi kết nối Supabase' },
      { status: 500 }
    )
  }
}
