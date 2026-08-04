'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, PenLine, ClipboardList, Users, BarChart2, Megaphone, User, Menu, X,
  type LucideIcon,
} from 'lucide-react'

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/lessons', label: 'Уроки', icon: BookOpen },
  { href: '/admin/questions', label: 'Вопросы', icon: PenLine },
  { href: '/admin/mock', label: 'Пробный ОРТ', icon: ClipboardList },
  { href: '/admin/students', label: 'Ученики', icon: Users },
  { href: '/admin/analytics', label: 'Аналитика', icon: BarChart2 },
  { href: '/admin/announcements', label: 'Объявления', icon: Megaphone },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Открыть меню"
        className="fixed left-4 top-3 z-30 rounded-lg border border-[#C3C6D7]/50 bg-white p-2 text-gray-500 shadow-sm lg:hidden"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-[#C3C6D7]/50 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <span className="text-lg font-extrabold tracking-tight text-[#1B4FD8]">ZHANGAK</span>
            <p className="text-xs font-medium text-gray-400">Admin Panel</p>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = item.href === '/admin' ? pathname === item.href : pathname?.startsWith(item.href) ?? false
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'border-[#1B4FD8] bg-gray-50 text-[#1B4FD8]' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-[#191B23]'}`}>
                <Icon size={18} />{item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[#C3C6D7]/50 px-3 py-4">
          <Link href="/admin/profile" onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#191B23]">
            <User size={18} /> Профиль
          </Link>
        </div>
      </aside>
    </>
  )
}
