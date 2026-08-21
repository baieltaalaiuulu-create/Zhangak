'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Map, PenLine, ClipboardList, Trophy, GraduationCap, Settings, X, ListChecks,
  type LucideIcon,
} from 'lucide-react'
import { PROFILE_COLOR_OPTIONS, type ProfileColor } from '@/lib/profile-preferences'

interface Props {
  isOpen: boolean
  onClose: () => void
  fullName?: string
  avatarUrl?: string | null
  profileColor?: ProfileColor
  pendingQuestRewards?: number
}

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/student/online/roadmap', label: 'Дорожная карта', icon: Map },
  { href: '/student/online', label: 'Главная', icon: LayoutDashboard },
  { href: '/student/online/lessons', label: 'Все уроки', icon: BookOpen },
  { href: '/student/online/practice', label: 'Тренажёр', icon: PenLine },
  { href: '/student/online/mock', label: 'Пробный ОРТ', icon: ClipboardList },
  { href: '/student/online/universities', label: 'Университеты', icon: GraduationCap },
  { href: '/student/online/quests', label: 'Квесты', icon: ListChecks },
  { href: '/student/online/leaderboard', label: 'Рейтинг', icon: Trophy },
]

export default function StudentSidebar({ isOpen, onClose, fullName = 'Студент', avatarUrl = null, profileColor = 'blue', pendingQuestRewards = 0 }: Props) {
  const pathname = usePathname()
  const initial = fullName?.[0]?.toUpperCase() ?? '?'
  const accent = PROFILE_COLOR_OPTIONS[profileColor].color

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        // hidden below md unconditionally — the mobile hamburger drawer this
        // isOpen/translate toggle was built for is dead code (nothing ever
        // calls setSidebarOpen(true); mobile navigation is BottomNav only),
        // so this can't rely on isOpen to also flip display:none→flex below
        // md without risking a Tailwind class-order specificity fight
        // between `hidden` and `flex` in the same conditional string.
        className={`fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 transition-transform duration-200 md:flex md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#0D0D1A' }}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-white">ZHANGAK</span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#8B5CF6' }} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть меню"
            className="rounded-lg p-1 text-gray-400 hover:bg-white/5 md:hidden"
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
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' } : undefined}
              >
                <Icon size={18} />
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.href.endsWith('/quests') && pendingQuestRewards > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{pendingQuestRewards}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-white/5 px-3 py-4">
          <Link
            href="/student/online/trainer"
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center rounded-xl py-2.5 text-center text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
          >
            + Начать тренажёр
          </Link>
          <Link
            href="/student/online/settings"
            onClick={onClose}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <Settings size={18} /> Настройки
          </Link>
          <Link
            href="/student/online/profile"
            onClick={onClose}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- externally hosted HTTPS avatar URL, no next/image domain config in this project
              <img src={avatarUrl} alt={fullName} className="h-[18px] w-[18px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: accent }}>
                {initial}
              </span>
            )}
            <span className="truncate">{fullName}</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
