'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogOut, type LucideIcon } from 'lucide-react'

interface Props {
  title: string
  actionLabel?: string
  actionIcon?: LucideIcon
  onAction?: () => void
}

export default function AdminTopbar({ title, actionLabel, actionIcon: ActionIcon, onAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-[#C3C6D7]/50 bg-white pl-16 pr-4 sm:px-6 lg:pl-6 print:hidden">
      <h1 className="truncate text-base font-bold text-[#191B23] sm:text-lg">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1B4FD8] px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
          >
            {ActionIcon && <ActionIcon size={16} />}
            {actionLabel}
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white"
          >
            A
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-40 rounded-xl border border-[#C3C6D7]/50 bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-50"
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
