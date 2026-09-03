// POST /api/revalidate?tag=bc-ngay|bc-thang|bc-tong
// Xoá cache của một BC, buộc lần tải sau gọi GAS mới
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { clearCacheBcNgay, clearCacheBcThang, clearCacheBcTong } from '@/lib/sheets'

const ALLOWED = ['bc-ngay', 'bc-thang', 'bc-tong'] as const
type Tag = typeof ALLOWED[number]

export async function POST(req: NextRequest) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const tag = req.nextUrl.searchParams.get('tag') as Tag | null
  if (!tag || !ALLOWED.includes(tag)) {
    return NextResponse.json({ error: 'tag không hợp lệ' }, { status: 400 })
  }

  if (tag === 'bc-ngay')   clearCacheBcNgay()
  if (tag === 'bc-thang')  clearCacheBcThang()
  if (tag === 'bc-tong')   clearCacheBcTong()

  return NextResponse.json({ ok: true, cleared: tag })
}
