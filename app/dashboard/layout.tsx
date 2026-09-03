import { verifySession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Kiểm tra đã đăng nhập chưa
  const user = await verifySession()
  if (!user) redirect('/')

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar cố định bên trái */}
      <Sidebar user={user} />

      {/* Nội dung chính */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
