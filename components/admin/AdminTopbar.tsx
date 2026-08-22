'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, type LucideIcon } from 'lucide-react'
import { getCurrentZhangakUser, logoutZhangak } from '@/lib/zhangak-auth-client'

interface Props {
  title: string
  actionLabel?: string
  actionIcon?: LucideIcon
  onAction?: () => void
}

export default function AdminTopbar({ title, actionLabel, actionIcon: ActionIcon, onAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullName, setFullName] = useState('Администратор')
  const [role, setRole] = useState('admin')
  const [logoutError, setLogoutError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let active = true
    getCurrentZhangakUser()
      .then(user => {
        if (!active || !user) return
        setFullName(user.fullName || 'Администратор')
        setRole(user.role)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const handleLogout = async () => {
    setLogoutError(false)
    try {
      await logoutZhangak()
      router.replace('/login')
    } catch {
      setLogoutError(true)
    }
  }

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'A'

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#C3C6D7]/50 bg-white pl-16 pr-4 sm:px-6 lg:pl-6 print:hidden"
      style={{ minHeight: 'calc(60px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <h1 className="truncate text-base font-bold text-[#191B23] sm:text-lg">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1B3F92] px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
          >
            {ActionIcon && <ActionIcon size={16} />}
            {actionLabel}
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={`Меню аккаунта: ${fullName}`}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D1E4A] text-xs font-bold text-white"
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-60 rounded-2xl border border-[#C3C6D7]/50 bg-white p-2 shadow-lg">
              <div className="border-b border-slate-100 px-2 py-2.5">
                <p className="truncate text-sm font-bold text-[#0D1E4A]">{fullName}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">{role === 'super_admin' ? 'Супер-администратор' : 'Администратор'}</p>
              </div>
              {logoutError && <p role="alert" className="px-2 py-2 text-xs font-semibold text-red-600">Не удалось завершить сессию. Повторите ещё раз.</p>}
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                <LogOut size={15} /> Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
