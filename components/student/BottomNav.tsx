'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  emoji: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/student/online', label: 'Главная', emoji: '🏠' },
  { href: '/student/online/lessons', label: 'Уроки', emoji: '📚' },
  { href: '/student/online/practice', label: 'Тренажёр', emoji: '✏️' },
  { href: '/student/online/mock', label: 'ОРТ', emoji: '🎯' },
  { href: '/student/online/ai', label: 'AI', emoji: '🤖' },
  { href: '/student/online/profile', label: 'Профиль', emoji: '👤' },
]

// Mobile-only replacement for the sidebar (StudentLayout hides this whole
// component at md and up, where the sidebar takes over navigation).
export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-[60px] items-stretch border-t border-[#C3C6D7]/50 bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/student/online'
          ? pathname === item.href
          : pathname?.startsWith(item.href) ?? false

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
          >
            <span className={`text-lg leading-none ${isActive ? '' : 'opacity-60'}`}>{item.emoji}</span>
            <span className={`max-w-full truncate text-[9px] font-semibold leading-none ${isActive ? 'text-[#1B4FD8]' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
