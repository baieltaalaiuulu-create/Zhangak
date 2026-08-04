'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, PenLine, ClipboardList, Brain, Trophy, Settings, User, X,
  type LucideIcon,
} from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/student/online', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/online/lessons', label: 'Уроки', icon: BookOpen },
  { href: '/student/online/practice', label: 'Практика', icon: PenLine },
  { href: '/student/online/mock', label: 'Пробный ОРТ', icon: ClipboardList },
  { href: '/student/online/ai', label: 'AI Коуч', icon: Brain },
  { href: '/student/online/leaderboard', label: 'Рейтинг', icon: Trophy },
]

export default function StudentSidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname()

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-[#C3C6D7]/50 transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <span className="text-lg font-extrabold tracking-tight text-[#1B4FD8]">ZHANGAK</span>
            <p className="text-xs font-medium text-gray-400">ORT Prep</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть меню"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = item.href === '/student/online'
              ? pathname === item.href
              : pathname?.startsWith(item.href) ?? false

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-[#1B4FD8] bg-gray-50 text-[#1B4FD8]'
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-[#191B23]'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-[#C3C6D7]/50 px-3 py-4">
          <Link
            href="/student/online/practice"
            onClick={onClose}
            className="block w-full rounded-xl bg-[#1B4FD8] py-2.5 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
          >
            Начать практику
          </Link>
          <Link
            href="/student/online/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#191B23]"
          >
            <Settings size={18} /> Настройки
          </Link>
          <Link
            href="/student/online/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#191B23]"
          >
            <User size={18} /> Профиль
          </Link>
        </div>
      </aside>
    </>
  )
}
