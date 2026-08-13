'use client'

import { useState } from 'react'
import { MoreHorizontal, KeyRound, Ban, CheckCircle2, Trash2 } from 'lucide-react'

interface Props {
  blocked: boolean
  disabled?: boolean
  onResetPassword: () => void
  onToggleBlock: () => void
  onDelete: () => void
}

export default function StudentActionsMenu({ blocked, disabled = false, onResetPassword, onToggleBlock, onDelete }: Props) {
  const [open, setOpen] = useState(false)

  const items: { label: string; icon: typeof KeyRound; onClick: () => void; danger?: boolean }[] = [
    { label: 'Сбросить пароль', icon: KeyRound, onClick: onResetPassword },
    { label: blocked ? 'Разблокировать' : 'Заблокировать', icon: blocked ? CheckCircle2 : Ban, onClick: onToggleBlock },
    { label: 'Удалить аккаунт', icon: Trash2, onClick: onDelete, danger: true },
  ]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-label="Действия" disabled={disabled}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
            {items.map(item => {
              const Icon = item.icon
              return (
                <button key={item.label} type="button" onClick={() => { setOpen(false); item.onClick() }} disabled={disabled}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <Icon size={15} />{item.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
