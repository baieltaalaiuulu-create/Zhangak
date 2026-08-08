'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, PenLine, ClipboardList, Brain, Trophy, GraduationCap, Settings, X,
  type LucideIcon,
} from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  fullName?: string
  avatarUrl?: string | null
}

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/student/online', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/online/lessons', label: 'Уроки', icon: BookOpen },
  { href: '/student/online/practice', label: 'Практика', icon: PenLine },
  { href: '/student/online/mock', label: 'Пробный ОРТ', icon: ClipboardList },
  { href: '/student/online/ai', label: 'AI Коуч', icon: Brain },
  { href: '/student/online/universities', label: '🎓 Университеты', icon: GraduationCap },
  { href: '/student/online/leaderboard', label: 'Рейтинг', icon: Trophy },
]

export default function StudentSidebar({ isOpen, onClose, fullName = 'Студент', avatarUrl = null }: Props) {
  const pathname = usePathname()
  const initial = fullName?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/5 transition-transform duration-200 lg:translate-x-0 ${
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
            className="rounded-lg p-1 text-gray-400 hover:bg-white/5 lg:hidden"
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' } : undefined}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-white/5 px-3 py-4">
          <Link
            href="/student/online/practice"
            onClick={onClose}
            className="block w-full rounded-xl py-2.5 text-center text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
          >
            + Начать практику
          </Link>
          <Link
            href="/student/online/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <Settings size={18} /> Настройки
          </Link>
          <Link
            href="/student/online/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, no next/image domain config in this project
              <img src={avatarUrl} alt={fullName} className="h-[18px] w-[18px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#6C3DE0' }}>
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
