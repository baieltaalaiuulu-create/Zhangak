'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import StudentVisualIcon from './StudentVisualIcon'

interface NavItem {
  href: string
  label: string
  icon: string
  primary?: boolean
  accent?: boolean
}

// Five destinations keep the mobile interface easy to scan. The roadmap sits
// in the centre as the primary action: a learner should return to the next
// meaningful step rather than a flat lesson catalogue.
const NAV_ITEMS: NavItem[] = [
  { href: '/student/online', label: 'Главная', icon: 'home' },
  { href: '/student/online/trainer', label: 'Тренажёр', icon: 'fitness_center' },
  { href: '/student/online/roadmap', label: 'Roadmap', icon: 'alt_route', primary: true },
  { href: '/student/online/quests', label: 'Квесты', icon: 'task_alt', accent: true },
  { href: '/student/online/profile', label: 'Профиль', icon: 'person' },
]

// Mobile-only replacement for the sidebar (StudentLayout hides this whole
// component at md and up, where the sidebar takes over navigation).
export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[430px] items-stretch border-t border-[#E2E8F0] bg-white md:hidden"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom))', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/student/online'
          ? pathname === item.href
          : pathname?.startsWith(item.href) ?? false
        const activeColor = item.accent ? '#6C3DE0' : '#1B3F92'
        const activeBackground = item.accent ? '#F2ECFF' : '#E8EDFA'

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5"
          >
            <span
              className="flex min-w-[46px] items-center justify-center rounded-full transition-colors"
              style={{
                width: item.primary ? 38 : undefined,
                height: item.primary ? 38 : 28,
                marginTop: item.primary ? -14 : 0,
                background: item.primary ? (isActive ? '#1B3F92' : '#E8EDFA') : isActive ? activeBackground : 'transparent',
                boxShadow: item.primary ? '0 3px 0 #153477' : undefined,
              }}
            >
              <StudentVisualIcon
                name={item.icon}
                size={23}
                filled={isActive || item.primary}
                color={item.primary ? (isActive ? '#FFFFFF' : '#1B3F92') : isActive ? activeColor : '#5F6B7A'}
              />
            </span>
            <span
              className="max-w-full truncate text-[10px] leading-none"
              style={{ color: isActive ? activeColor : '#5F6B7A', fontWeight: isActive || item.primary ? 800 : 600 }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
