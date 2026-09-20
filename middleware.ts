import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// middleware chạy ở Edge Runtime — không throw ở module level
// mà kiểm tra trong mỗi request để tránh crash toàn bộ middleware
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? ''
)

export async function middleware(request: NextRequest) {
  // Fail-fast nếu JWT_SECRET chưa được cấu hình
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Cấu hình server thiếu JWT_SECRET' }, { status: 500 })
  }

  const { pathname } = request.nextUrl

  // Bỏ qua static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // Bỏ qua API auth (login/logout)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const token = request.cookies.get('bao-cao-session')?.value

  // Trang login (/)
  if (pathname === '/') {
    if (token) {
      try {
        await jwtVerify(token, JWT_SECRET)
        // Đã đăng nhập → vào thẳng dashboard, không cần login lại
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } catch {
        // Token hết hạn → xóa cookie, cho vào login
        const res = NextResponse.next()
        res.cookies.delete('bao-cao-session')
        return res
      }
    }
    return NextResponse.next()
  }

  // Các trang protected
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete('bao-cao-session')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
