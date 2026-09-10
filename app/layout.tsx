import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Báo Cáo Nội Bộ',
  description: 'Dashboard báo cáo dành cho nội bộ công ty',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: tránh warning khi script chèn class 'dark' trước React hydrate
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Favicon - dùng file PNG/ICO để tương thích mọi trình duyệt */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        {/* Chống flash theme: áp dụng class 'dark' ngay trước khi React mount */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`
        }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
