import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_change_this_in_production_32chars'
)

// Các trang không cần đăng nhập
const PUBLIC_PATHS = ['/', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bỏ qua trang public
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Bỏ qua static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // Kiểm tra session cookie
  const token = request.cookies.get('bao-cao-session')?.value

  if (!token) {
    // Chưa đăng nhập → redirect về trang login
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    // Token hết hạn hoặc không hợp lệ
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete('bao-cao-session')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
