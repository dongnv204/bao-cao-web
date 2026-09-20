/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Security headers cho mọi response
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Ngăn clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Ngăn MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Giảm thông tin referrer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Giới hạn browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Bảo vệ HTTPS (1 năm, bao gồm subdomain)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
