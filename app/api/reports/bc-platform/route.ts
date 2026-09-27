import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getBCPlatformReport } from '@/lib/sheets'

export async function GET(request: NextRequest) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = Number(searchParams.get('month'))
  const year  = Number(searchParams.get('year'))

  if (!month || !year)
    return NextResponse.json({ error: 'Thiếu tham số month hoặc year' }, { status: 400 })

  try {
    const result = await getBCPlatformReport(month, year)
    if (!result || result.ok === false)
      return NextResponse.json({ error: result?.error }, { status: 502 })
    return NextResponse.json(result.data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
