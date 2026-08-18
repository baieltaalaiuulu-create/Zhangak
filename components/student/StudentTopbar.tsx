'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Bell, Flame, Search, Star, Target } from 'lucide-react'
import { PROFILE_COLOR_OPTIONS, type ProfileColor } from '@/lib/profile-preferences'
import StudentVisualIcon from './StudentVisualIcon'

interface Props {
  fullName: string
  avatarUrl: string | null
  profileColor: ProfileColor
  streak: number
  xp: number
  targetScore: number
  level: number
  unreadCount?: number
  onLogout: () => void
}

function Pill({ children, tone = 'gray', className = '' }: { children: ReactNode; tone?: 'gray' | 'orange' | 'blue'; className?: string }) {
  const toneClass = tone === 'orange'
    ? 'bg-orange-50 text-orange-600'
    : tone === 'blue'
      ? 'bg-[#EEF2FF] text-[#1B3F92]'
      : 'bg-gray-50 text-gray-600'

  return (
    <span className={`items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${toneClass} ${className}`}>
      {children}
    </span>
  )
}

export default function StudentTopbar({ fullName, avatarUrl, profileColor, streak, xp, targetScore, level, unreadCount = 0, onLogout }: Props) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = fullName?.[0]?.toUpperCase() ?? '?'
  const accent = PROFILE_COLOR_OPTIONS[profileColor].color

  return (
    <header className="sticky top-0 z-20 flex h-[56px] items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 sm:px-6">
      {/* Compact HUD for the mobile-first student experience. It only shows
          values the first-party backend currently owns, never mock XP. */}
      <div className="grid min-w-0 flex-1 grid-cols-3 items-center gap-2 md:hidden">
        <span className="inline-flex items-center gap-1 text-[15px] font-extrabold text-[#0F172A]">
          <StudentVisualIcon name="local_fire_department" size={20} color="#D97706" /> {streak}
        </span>
        <span className="inline-flex min-w-0 items-center justify-center gap-1 text-[15px] font-extrabold text-[#0F172A]">
          <StudentVisualIcon name="bolt" size={20} color="#1B3F92" /> <span className="truncate">{xp.toLocaleString('ru-RU')}</span>
        </span>
        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-[#E8FAEF] px-2.5 py-1.5 text-[12px] font-extrabold text-[#16A34A]">
          <StudentVisualIcon name="flag" size={18} color="#16A34A" /> {targetScore}
        </span>
      </div>

      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск уроков, тем..."
          className="w-full rounded-full bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3F92]/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {streak > 0 && (
          <Pill tone="orange" className="hidden md:inline-flex">
            <Flame size={14} aria-hidden="true" />
            {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
          </Pill>
        )}
        <Pill tone="blue" className="hidden md:inline-flex">
          <Target size={14} aria-hidden="true" />
          {targetScore} балл
        </Pill>
        <Pill className="hidden md:inline-flex">
          <Star size={14} aria-hidden="true" />
          Ур. {level}
        </Pill>

        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setNotifOpen(v => !v)}
            aria-label="Уведомления"
            className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 w-56 rounded-xl border border-[#C3C6D7]/50 bg-white p-4 text-center text-xs text-gray-400 shadow-lg">
              {unreadCount > 0 ? `Непрочитанных: ${unreadCount}` : 'Уведомлений пока нет'}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Меню профиля"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- externally hosted HTTPS avatar URL, no next/image domain config in this project
              <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-48 rounded-xl border border-[#C3C6D7]/50 bg-white p-2 shadow-lg">
              <div className="truncate border-b border-gray-100 px-2 py-2 text-xs text-gray-400">
                {fullName}
              </div>
              {/* Mobile-only — desktop reaches /profile via the sidebar, and
                  the bottom nav is capped at 5 items so it lives here instead. */}
              <Link
                href="/student/online/profile"
                className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-gray-600 hover:bg-gray-50 md:hidden"
              >
                Профиль
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
