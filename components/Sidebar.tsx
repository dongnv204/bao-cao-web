'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface SidebarProps {
  user: {
    username: string
    full_name: string
    role: string
  }
}

// ── Cấu trúc nav — hỗ trợ children (sub-menu) ────────────────────────
const NAV_ITEMS = [
  {
    label: 'Tổng quan',
    href: '/dashboard',
    exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ['admin', 'manager', 'viewer'],
  },
  {
    label: 'Tuyển Dụng',
    href: '/dashboard/tuyen-dung',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    roles: ['admin', 'manager', 'viewer'],
    // Sub-menu hiện khi đang trong nhóm /dashboard/tuyen-dung hoặc /dashboard/bc-thang
    children: [
      { label: 'BC Ngày',   href: '/dashboard/tuyen-dung' },
      { label: 'BC Tháng',  href: '/dashboard/bc-thang'   },
      { label: 'BC Tổng',   href: '/dashboard/bc-tong'    },
    ],
  },
  {
    label: 'Doanh Thu',
    href: '/dashboard/doanh-thu',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    roles: ['admin', 'manager'],
  },
  {
    label: 'Vận Hành',
    href: '/dashboard/van-hanh',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    roles: ['admin', 'manager'],
  },
  {
    label: 'Nhân Sự / KPI',
    href: '/dashboard/nhan-su',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    roles: ['admin', 'manager'],
  },
]

// Menu chỉ Admin mới thấy
const ADMIN_ITEMS = [
  {
    label: 'Quản lý User',
    href: '/dashboard/admin/users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:   { label: 'Admin',   color: 'bg-red-50 text-red-600 border-red-200' },
  manager: { label: 'Manager', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  viewer:  { label: 'Viewer',  color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const roleBadge = ROLE_LABELS[user.role] || ROLE_LABELS.viewer

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role))

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-slate-200
                      flex flex-col z-40 shadow-sm shadow-slate-200/50">
      {/* Header */}
      <div className="px-5 py-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-semibold text-sm leading-none">Báo Cáo Nội Bộ</p>
            <p className="text-slate-400 text-xs mt-0.5">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
          Báo cáo
        </p>

        {visibleNav.map(item => {
          // Kiểm tra item hoặc bất kỳ child nào đang active
          const childHrefs   = item.children?.map(c => c.href) ?? []
          const groupActive  = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
            childHrefs.some(h => pathname === h || pathname.startsWith(h))

          // Item cha active chỉ khi đúng URL của nó (không phải child)
          const parentActive = item.exact
            ? pathname === item.href
            : (pathname === item.href && !childHrefs.includes(pathname))

          return (
            <div key={item.href}>
              {/* Item cha */}
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                  ${parentActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : groupActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>

              {/* Sub-menu — hiện khi group đang active */}
              {item.children && groupActive && (
                <div className="ml-8 mt-0.5 space-y-0.5">
                  {item.children.map(child => {
                    const childActive = pathname === child.href ||
                      (child.href !== item.href && pathname.startsWith(child.href))
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                          ${childActive
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Admin menu */}
        {user.role === 'admin' && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Quản trị
              </p>
            </div>
            {ADMIN_ITEMS.map(item => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                    ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
            <span className="text-blue-600 text-xs font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 text-sm font-medium truncate">{user.full_name}</p>
            <span className={`inline-block text-xs px-1.5 py-0.5 rounded border ${roleBadge.color}`}>
              {roleBadge.label}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                     text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
