import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * GET /api/reports/bc-test?action=stats&month=9&year=2026
 * GET /api/reports/bc-test?action=search&q=0912345678
 * GET /api/reports/bc-test?action=list&month=9&year=2026&page=1&recruiter=C.Hoa
 */
export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const action    = searchParams.get('action') || 'stats'
  const month     = Number(searchParams.get('month')) || new Date().getMonth() + 1
  const year      = Number(searchParams.get('year'))  || new Date().getFullYear()
  const q         = searchParams.get('q') || ''
  const page      = Math.max(1, Number(searchParams.get('page')) || 1)
  const recruiter = searchParams.get('recruiter') || ''
  const PAGE_SIZE = 50

  const supabase = getSupabase()

  try {
    // ── STATS: tổng quan tháng ───────────────────────────────────────
    if (action === 'stats') {
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const last  = new Date(year, month, 0).getDate()
      const end   = `${year}-${String(month).padStart(2,'0')}-${String(last).padStart(2,'0')}`

      const { data, error } = await supabase
        .from('candidates')
        .select('check_sdt, trang_thai, recruiter, ngay_nhap')
        .gte('ngay_nhap', start)
        .lte('ngay_nhap', end)

      if (error) throw error

      const rows = data || []
      const isTrung  = (v: string) => (v || '').toLowerCase().includes('trùng')
      const isHopLe  = (v: string) => { const s = (v||'').toLowerCase(); return s === '' || s.includes('hợp lệ') }
      const isNet    = (r: any)    => !isTrung(r.check_sdt) && !['loại','từ chối','không đạt'].some(x => (r.trang_thai||'').toLowerCase().includes(x))

      const formNhap = rows.length
      const hopLe    = rows.filter(r => isHopLe(r.check_sdt)).length
      const trung    = rows.filter(r => isTrung(r.check_sdt)).length
      const chuaCheck= rows.filter(r => !r.check_sdt || r.check_sdt.trim() === '').length
      const uvNet    = rows.filter(r => isNet(r)).length

      // By recruiter
      const byRec: Record<string, any> = {}
      rows.forEach(r => {
        const k = r.recruiter || 'Khác'
        if (!byRec[k]) byRec[k] = { formNhap:0, hopLe:0, trung:0, uvNet:0 }
        byRec[k].formNhap++
        if (isHopLe(r.check_sdt)) byRec[k].hopLe++
        if (isTrung(r.check_sdt)) byRec[k].trung++
        if (isNet(r)) byRec[k].uvNet++
      })

      // By day — đếm uvNet mỗi ngày để vẽ chart
      const byDay: Record<string, number> = {}
      rows.filter(r => isNet(r)).forEach(r => {
        byDay[r.ngay_nhap] = (byDay[r.ngay_nhap] || 0) + 1
      })
      const dailyNet = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b))
        .map(([ngay, count]) => ({ ngay, count }))

      return NextResponse.json({
        ok: true,
        data: {
          month, year, formNhap, hopLe, trung, chuaCheck, uvNet,
          tyLeHl: (hopLe + trung) > 0 ? hopLe / (hopLe + trung) * 100 : null,
          byRecruiter: Object.entries(byRec).map(([recruiter, s]) => ({ recruiter, ...s })),
          dailyNet,
        }
      })
    }

    // ── SEARCH: tìm theo SĐT hoặc tên ────────────────────────────────
    if (action === 'search') {
      if (!q || q.length < 2) return NextResponse.json({ ok: true, data: [] })

      const isPhone = /^\d+$/.test(q.trim())
      let query = supabase.from('candidates').select('*').order('ngay_nhap', { ascending: false }).limit(100)

      if (isPhone) {
        query = query.ilike('sdt', `%${q.trim()}%`)
      } else {
        query = query.ilike('ten_uv', `%${q.trim()}%`)
      }

      const { data, error } = await query
      if (error) throw error

      return NextResponse.json({ ok: true, data: data || [] })
    }

    // ── LIST: danh sách UV theo tháng, có phân trang ──────────────────
    if (action === 'list') {
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const last  = new Date(year, month, 0).getDate()
      const end   = `${year}-${String(month).padStart(2,'0')}-${String(last).padStart(2,'0')}`

      let query = supabase
        .from('candidates')
        .select('*', { count: 'exact' })
        .gte('ngay_nhap', start)
        .lte('ngay_nhap', end)
        .order('ngay_nhap', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (recruiter) query = query.eq('recruiter', recruiter)

      const { data, error, count } = await query
      if (error) throw error

      return NextResponse.json({
        ok: true,
        data: data || [],
        total: count || 0,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      })
    }

    return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 })

  } catch (err: any) {
    console.error('BC Test API error:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi server' }, { status: 500 })
  }
}
