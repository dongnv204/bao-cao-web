import { verifySession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { TabsStoreProvider } from './tabs-store'
import { ToastProvider } from '@/components/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Kiểm tra đã đăng nhập chưa
  const user = await verifySession()
  if (!user) redirect('/')

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar cố định bên trái */}
      <Sidebar user={user} />

      {/* Nội dung chính — ToastProvider bọc toàn bộ dashboard */}
      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8 pt-16 md:pt-8">
          <ToastProvider>
            <TabsStoreProvider>
              {children}
            </TabsStoreProvider>
          </ToastProvider>
        </div>
      </main>
    </div>
  )
}
