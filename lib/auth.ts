import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_change_this_in_production_32chars'
)

const COOKIE_NAME = 'bao-cao-session'

// Tạo JWT token sau khi đăng nhập thành công
export async function createSession(user: {
  id: string
  username: string
  full_name: string
  role: string
}) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h') // Hết hạn sau 8 giờ làm việc
    .setIssuedAt()
    .sign(JWT_SECRET)

  return token
}

// Xác minh token từ cookie
export async function verifySession() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as {
      id: string
      username: string
      full_name: string
      role: string
    }
  } catch {
    return null
  }
}

// Tên cookie dùng chung
export { COOKIE_NAME }
