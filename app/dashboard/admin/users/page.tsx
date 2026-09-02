import { verifySession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import UserManagement from './UserManagement'

export default async function AdminUsersPage() {
  const user = await verifySession()

  // Chỉ admin mới vào được trang này
  if (!user || user.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Quản Lý Người Dùng</h1>
        <p className="text-slate-400 text-sm mt-1">Tạo, chỉnh sửa và phân quyền tài khoản</p>
      </div>
      <UserManagement />
    </div>
  )
}
