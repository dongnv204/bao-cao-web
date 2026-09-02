import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hệ Thống Báo Cáo Nội Bộ',
  description: 'Dashboard báo cáo dành cho nội bộ công ty',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
