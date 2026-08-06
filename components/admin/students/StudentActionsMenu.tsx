'use client'

import { useState } from 'react'
import { MoreHorizontal, Eye, Pencil, Wallet, History, Ban, CheckCircle2, Trash2 } from 'lucide-react'

interface Props {
  blocked: boolean
  onViewProfile: () => void
  onEdit: () => void
  onAddPayment: () => void
  onPaymentHistory: () => void
  onToggleBlock: () => void
  onDelete: () => void
}

export default function StudentActionsMenu({ blocked, onViewProfile, onEdit, onAddPayment, onPaymentHistory, onToggleBlock, onDelete }: Props) {
  const [open, setOpen] = useState(false)

  const items: { label: string; icon: typeof Eye; onClick: () => void; danger?: boolean }[] = [
    { label: 'Посмотреть профиль', icon: Eye, onClick: onViewProfile },
    { label: 'Редактировать', icon: Pencil, onClick: onEdit },
    { label: 'Добавить платёж', icon: Wallet, onClick: onAddPayment },
    { label: 'История платежей', icon: History, onClick: onPaymentHistory },
    { label: blocked ? 'Разблокировать' : 'Заблокировать', icon: blocked ? CheckCircle2 : Ban, onClick: onToggleBlock },
    { label: 'Удалить', icon: Trash2, onClick: onDelete, danger: true },
  ]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-label="Действия"
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
            {items.map(item => {
              const Icon = item.icon
              return (
                <button key={item.label} type="button" onClick={() => { setOpen(false); item.onClick() }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}>
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
