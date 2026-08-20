'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Archive, BarChart2, BookOpen, Brain, ClipboardList, GraduationCap, LayoutDashboard, ListChecks, ListTree, Megaphone, Menu, PenLine, ReceiptText,
  Settings, ShieldCheck, Trophy, Users, X, Zap,
  type LucideIcon,
} from 'lucide-react'

type NavAvailability = 'ready' | 'migration'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  availability: NavAvailability
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard, availability: 'ready' },
  { href: '/admin/lessons', label: 'Уроки', icon: BookOpen, availability: 'ready' },
  { href: '/admin/roadmap', label: 'Дорожная карта', icon: ListTree, availability: 'ready' },
  { href: '/admin/groups', label: 'Группы', icon: Users, availability: 'ready' },
  { href: '/admin/students', label: 'Ученики', icon: Users, availability: 'ready' },
  { href: '/admin/applications', label: 'Заявки и оплаты', icon: ReceiptText, availability: 'ready' },
  { href: '/admin/practice', label: 'Практика', icon: ListChecks, availability: 'ready' },
  { href: '/admin/questions', label: 'Вопросы', icon: PenLine, availability: 'ready' },
  { href: '/admin/mock', label: 'Пробный ОРТ', icon: ClipboardList, availability: 'ready' },
  { href: '/admin/daily-challenge', label: 'Задание дня', icon: Zap, availability: 'ready' },
  { href: '/admin/gamification', label: 'Квесты и достижения', icon: Trophy, availability: 'ready' },
  { href: '/admin/settings', label: 'Настройки', icon: Settings, availability: 'ready' },
  { href: '/admin/prizes', label: 'Рейтинг и призы', icon: Trophy, availability: 'migration' },
  { href: '/admin/knowledge-base', label: 'База знаний AI', icon: Brain, availability: 'migration' },
  { href: '/admin/universities', label: 'Университеты', icon: GraduationCap, availability: 'migration' },
  { href: '/admin/archive', label: 'Архив', icon: Archive, availability: 'migration' },
  { href: '/admin/analytics', label: 'Аналитика', icon: BarChart2, availability: 'migration' },
  { href: '/admin/announcements', label: 'Объявления', icon: Megaphone, availability: 'migration' },
  { href: '/admin/access', label: 'Доступ и аудит', icon: ShieldCheck, availability: 'ready', superAdminOnly: true },
]

const NAV_GROUPS: { label: string; availability: NavAvailability; hrefs: string[] }[] = [
  { label: 'Рабочие разделы', availability: 'ready', hrefs: ['/admin', '/admin/lessons', '/admin/roadmap', '/admin/groups', '/admin/students', '/admin/applications', '/admin/practice', '/admin/questions', '/admin/mock', '/admin/daily-challenge', '/admin/gamification', '/admin/settings'] },
  {
    label: 'Перенос на наш backend',
    availability: 'migration',
    hrefs: [
      '/admin/prizes', '/admin/knowledge-base',
      '/admin/universities', '/admin/archive', '/admin/analytics', '/admin/announcements',
    ],
  },
  { label: 'Доступ и безопасность', availability: 'ready', hrefs: ['/admin/access'] },
]

interface Props {
  role?: 'admin' | 'super_admin' | null
}

export default function AdminSidebar({ role = null }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const visibleItems = NAV_ITEMS.filter(item => !item.superAdminOnly || role === 'super_admin')

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Открыть меню"
        className="fixed left-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-[#C3C6D7]/50 bg-white text-gray-500 shadow-sm lg:hidden print:hidden"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-[#C3C6D7]/50 transition-transform duration-200 lg:translate-x-0 print:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local brand asset */}
            <img src="/images/logo.png" alt="Логотип Жангак" className="h-10 w-10 rounded-xl object-cover" />
            <div>
              <span className="text-base font-extrabold tracking-tight text-[#0D1E4A]">ZHANGAK</span>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">Управление</p>
            </div>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Административные разделы">
          {NAV_GROUPS.map(group => {
            const groupItems = visibleItems.filter(item => group.hrefs.includes(item.href))
            if (groupItems.length === 0) return null
            return (
            <div key={group.label} className="mb-5">
              <p className={`mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] ${group.availability === 'migration' ? 'text-amber-600' : 'text-slate-400'}`}>{group.label}</p>
              <div className="space-y-1">
                {groupItems.map(item => {
                  const Icon = item.icon
                  const isActive = item.href === '/admin' ? pathname === item.href : pathname?.startsWith(item.href) ?? false
                  const isMigrating = item.availability === 'migration'
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={isMigrating ? `${item.label}: переносится на собственный backend` : item.label}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        isMigrating
                          ? isActive
                            ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200'
                            : 'text-slate-500 hover:bg-amber-50 hover:text-amber-800'
                          : isActive
                            ? 'bg-blue-50 text-[#1B3F92]'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-[#191B23]'
                      }`}>
                      <Icon size={18} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {isMigrating && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800">Скоро</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
            )
          })}
        </nav>
        <p className="border-t border-[#C3C6D7]/50 px-6 py-4 text-[11px] font-semibold leading-4 text-slate-400">
          {role === 'super_admin'
            ? 'Доступ к ролям и журналу действий — в разделе «Доступ и аудит». Инфраструктура VPS не управляется из браузера.'
            : 'Вы управляете учебным процессом и аккаунтами учеников. Роли сотрудников и журнал действий доступны только супер-администратору.'}
        </p>
      </aside>
    </>
  )
}
