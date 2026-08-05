'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import DeleteAccountModal from './DeleteAccountModal'

interface Props {
  onDeleteAccount: () => Promise<void>
}

export default function DangerZoneCard({ onDeleteAccount }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-red-100 bg-white p-5">
      <div className="flex items-center gap-2">
        <Trash2 size={16} className="text-red-500" />
        <h2 className="text-sm font-bold text-[#191B23]">Опасная зона</h2>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Удаление аккаунта необратимо и удалит весь ваш прогресс.
      </p>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-500 transition-colors hover:bg-red-50"
      >
        Удалить аккаунт
      </button>

      {modalOpen && (
        <DeleteAccountModal onClose={() => setModalOpen(false)} onConfirm={onDeleteAccount} />
      )}
    </div>
  )
}
