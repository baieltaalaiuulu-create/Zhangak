'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, PenLine, Trophy, Sparkles, type LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

// Exactly 5 items per the mobile nav spec — Профиль lives in the desktop
// sidebar (and the topbar's mobile-only avatar menu item, see
// StudentTopbar.tsx) instead of taking a 6th slot here.
const NAV_ITEMS: NavItem[] = [
  { href: '/student/online', label: 'Главная', icon: Home },
  { href: '/student/online/lessons', label: 'Уроки', icon: BookOpen },
  { href: '/student/online/practice', label: 'Тренажёр', icon: PenLine },
  { href: '/student/online/mock', label: 'ОРТ', icon: Trophy },
  { href: '/student/online/ai', label: 'AI', icon: Sparkles },
]

// Mobile-only replacement for the sidebar (StudentLayout hides this whole
// component at md and up, where the sidebar takes over navigation).
export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex w-full items-stretch border-t border-[#C3C6D7]/50 bg-white md:hidden"
      style={{ minHeight: '64px', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/student/online'
          ? pathname === item.href
          : pathname?.startsWith(item.href) ?? false
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1"
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#1B4FD8]' : 'text-gray-400'} />
            <span className={`max-w-full truncate text-[10px] font-semibold leading-none ${isActive ? 'text-[#1B4FD8]' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
