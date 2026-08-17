'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, PenLine, Trophy, Sparkles, type LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  primary?: boolean
}

// Exactly 5 items per the mobile nav spec — Профиль lives in the desktop
// sidebar (and the topbar's mobile-only avatar menu item, see
// StudentTopbar.tsx) instead of taking a 6th slot here.
const NAV_ITEMS: NavItem[] = [
  // The course map is the primary learning action. It comes first so a
  // student lands on the next meaningful step, not a flat lesson catalogue.
  { href: '/student/online/roadmap', label: 'Карта', icon: Map, primary: true },
  { href: '/student/online', label: 'Главная', icon: Home },
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
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-50 flex w-full items-stretch border-t border-[#C3C6D7]/50 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md md:hidden"
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
            aria-current={isActive ? 'page' : undefined}
            className="group flex min-h-16 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-0.5"
          >
            <span className={`flex min-w-10 items-center justify-center rounded-full px-2 transition-colors ${
              item.primary
                ? isActive ? 'h-8 -translate-y-1 bg-[#1B3F92] text-white shadow-[0_3px_0_#102C69]' : 'h-8 -translate-y-1 bg-[#EAF2FF] text-[#1B3F92] shadow-[0_3px_0_#C8D8F1] group-active:translate-y-0 group-active:shadow-none'
                : isActive ? 'h-7 bg-blue-50 text-[#1B3F92]' : 'h-7 text-gray-400 group-active:bg-gray-50'
            }`}>
              <Icon size={21} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
            </span>
            <span className={`max-w-full truncate text-[10px] leading-none ${isActive ? 'font-bold text-[#1B3F92]' : 'font-medium text-gray-500'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
