import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// API BC Test — đọc Supabase, trả về cùng format với BC Ngày (bang1/bang2/bang3)
// Không có bang4 vì Supabase không có cột mã trang

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

interface CRow {
  ngay_nhap:  string
  check_sdt:  string
  trang_thai: string
  recruiter:  string
}

// ── Kiểm tra trạng thái — giống BC Ngày ──────────────────────────────────────
// hlNet  = CÓ chữ 'hợp lệ' (không tính ô trống)
function isHl(v: string)    { return (v || '').toLowerCase().includes('hợp lệ') }
function isTr(v: string)    { return (v || '').toLowerCase().includes('trùng') }
function isLoai(tt: string) {
  const s = (tt || '').toLowerCase()
  return s.includes('loại') || s.includes('từ chối') || s.includes('không đạt')
}

function calcStats(rows: CRow[]) {
  const formNhap  = rows.length
  // Supabase không có bước lọc riêng → uvLoc = formNhap
  const uvLoc     = formNhap
  const hlNet     = rows.filter(r => isHl(r.check_sdt)).length
  const trungNet  = rows.filter(r => isTr(r.check_sdt)).length
  const chuaCheck = rows.filter(r => !r.check_sdt || r.check_sdt.trim() === '').length
  // uvNet = không trùng VÀ không bị loại
  const uvNet     = rows.filter(r => !isTr(r.check_sdt) && !isLoai(r.trang_thai)).length
  const tyLeHl    = (hlNet + trungNet) > 0 ? hlNet / (hlNet + trungNet) * 100 : null
  const pctHaoHut = formNhap > 0 ? (formNhap - uvNet) / formNhap * 100 : null
  return { formNhap, uvLoc, hlNet, trungNet, chuaCheck, uvNet, tyLeHl, pctHaoHut }
}

function thuVi(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
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
    const supabase  = getSupabase()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Lấy toàn bộ tháng 1 lần duy nhất
    const { data, error } = await supabase
      .from('candidates')
      .select('ngay_nhap, check_sdt, trang_thai, recruiter')
      .gte('ngay_nhap', startDate)
      .lte('ngay_nhap', endDate)
      .order('ngay_nhap')

    if (error) throw new Error(`Supabase error: ${error.message}`)
    const rows: CRow[] = (data || []) as CRow[]

    // Ngày hiện tại (mặc định = hôm nay trong tháng nếu không truyền day)
    const currentDay = day ?? new Date().getDate()
    const dateStr    = `${year}-${String(month).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`

    const rowsNgay  = rows.filter(r => r.ngay_nhap === dateStr)
    const rowsThang = day ? rows.filter(r => r.ngay_nhap <= dateStr) : rows
    const sNgay     = calcStats(rowsNgay)
    const sThang    = calcStats(rowsThang)

    // ── BẢNG 1 — format giống tuyen-dung API ─────────────────────────────────
    const bang1 = {
      // Tháng (target = 0 vì Supabase không có mục tiêu)
      formNhapThang:    sThang.formNhap,
      targetFormThang:  0,
      uvLocThang:       sThang.uvLoc,
      targetUvLocThang: 0,
      uvNetThang:       sThang.uvNet,
      targetUvNetThang: 0,
      hlNetThang:       sThang.hlNet,
      targetHlNetThang: 0,
      trungNetThang:    sThang.trungNet,
      targetTrungThang: 0,
      tyLeHlThang:      sThang.tyLeHl,
      chuaCheckThang:   sThang.chuaCheck,
      // Ngày
      formNhapNgay:    sNgay.formNhap,
      targetFormNgay:  0,
      uvLocNgay:       sNgay.uvLoc,
      uvNetNgay:       sNgay.uvNet,
      targetUvNetNgay: 0,
      hlNetNgay:       sNgay.hlNet,
      targetHlNetNgay: 0,
      trungNetNgay:    sNgay.trungNet,
      targetTrungNgay: 0,
      hlThoNgay:       sNgay.hlNet,
      trungThoNgay:    sNgay.trungNet,
    }

    // ── BẢNG 2 — ngày hiện tại + theo recruiter ──────────────────────────────
    const recruitersMap: Record<string, CRow[]> = {}
    rowsNgay.forEach(r => {
      const key = r.recruiter || 'Khác'
      if (!recruitersMap[key]) recruitersMap[key] = []
      recruitersMap[key].push(r)
    })

    const nguon = Object.entries(recruitersMap)
      .map(([ten, list]) => {
        const s = calcStats(list)
        return { ten, uvNet: s.uvNet, hlNet: s.hlNet, trungNet: s.trungNet, tyLeHl: s.tyLeHl, chuaCheck: s.chuaCheck }
      })
      .sort((a, b) => b.uvNet - a.uvNet)

    const bang2 = {
      tho: {
        formNhap:       sNgay.formNhap,
        targetFormNgay: 0,
        uvLoc:          sNgay.uvLoc,
        hlTho:          sNgay.hlNet,
        pctHlTho:       sNgay.uvLoc > 0 ? sNgay.hlNet / sNgay.uvLoc * 100 : null,
        trungTho:       sNgay.trungNet,
        pctTrungTho:    sNgay.uvLoc > 0 ? sNgay.trungNet / sNgay.uvLoc * 100 : null,
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
    const byDay: Record<string, CRow[]> = {}
    rows.forEach(r => {
      if (!byDay[r.ngay_nhap]) byDay[r.ngay_nhap] = []
      byDay[r.ngay_nhap].push(r)
    })

    const bang3Rows = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ngayStr, dayRows]) => {
        const s = calcStats(dayRows)
        const d = new Date(ngayStr + 'T00:00:00')
        return {
          ngay:      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          thu:       thuVi(ngayStr),
          formNhap:  s.formNhap,
          uvLoc:     s.uvLoc,
          pctHaoHut: s.pctHaoHut,
          uvNet:     s.uvNet,
          hlNet:     s.hlNet,
          trungNet:  s.trungNet,
          chuaCheck: s.chuaCheck,
          pctHl:     s.tyLeHl,
          isSelected: ngayStr === dateStr,
        }
      })

    // Dòng tổng
    const sTotal = calcStats(rows)
    const totalRow = {
      ngay:      'Tổng',
      thu:       '—',
      formNhap:  sTotal.formNhap,
      uvLoc:     sTotal.uvLoc,
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
