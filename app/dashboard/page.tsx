import { verifySession } from '@/lib/auth'

// Card tổng quan mỗi loại báo cáo
const REPORT_CARDS = [
  {
    title: 'Báo Cáo Tuyển Dụng',
    description: 'Chỉ số UV, HL Net, Trùng Net, phân bổ theo nguồn và mã trang',
    href: '/dashboard/tuyen-dung',
    icon: '👥',
    color: 'from-blue-500 to-blue-600',
    roles: ['admin', 'manager', 'viewer'],
  },
  {
    title: 'Báo Cáo Doanh Thu',
    description: 'Theo dõi doanh thu, chi phí, lợi nhuận theo tháng',
    href: '/dashboard/doanh-thu',
    icon: '💰',
    color: 'from-emerald-500 to-emerald-600',
    roles: ['admin', 'manager'],
  },
  {
    title: 'Báo Cáo Vận Hành',
    description: 'Chỉ số điều phối, hiệu suất vận hành theo kỳ',
    href: '/dashboard/van-hanh',
    icon: '⚙️',
    color: 'from-violet-500 to-violet-600',
    roles: ['admin', 'manager'],
  },
  {
    title: 'Nhân Sự / KPI',
    description: 'KPI nhân viên, tỷ lệ đạt mục tiêu, đánh giá hiệu suất',
    href: '/dashboard/nhan-su',
    icon: '🎯',
    color: 'from-orange-500 to-orange-600',
    roles: ['admin', 'manager'],
  },
]

export default async function DashboardPage() {
  const user = await verifySession()
  if (!user) return null

  const now = new Date()
  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const visibleCards = REPORT_CARDS.filter(c => c.roles.includes(user.role))

  return (
    <div>
      {/* Tiêu đề trang */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Xin chào, {user.full_name} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm capitalize">{dateStr}</p>
      </div>

      {/* Grid báo cáo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleCards.map(card => (
          <a
            key={card.href}
            href={card.href}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6
                       hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60 transition overflow-hidden"
          >
            {/* Gradient nền */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color}
                            opacity-10 rounded-full -translate-y-8 translate-x-8 group-hover:opacity-20 transition`} />

            <div className="relative">
              <div className="text-3xl mb-4">{card.icon}</div>
              <h2 className="text-slate-900 font-semibold text-lg mb-2">{card.title}</h2>
              <p className="text-slate-500 text-sm leading-relaxed">{card.description}</p>

              <div className="mt-5 flex items-center gap-1.5 text-blue-600 text-sm font-medium">
                Xem báo cáo
                <svg className="w-4 h-4 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Thông tin nhanh */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <p className="text-blue-800 text-sm">
          💡 Dữ liệu được đồng bộ tự động từ Google Sheets mỗi 30 phút.
          Nếu cần cập nhật ngay, vào Google Sheets và chạy lại báo cáo.
        </p>
      </div>
    </div>
  )
}
