'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import DeleteAccountModal from './DeleteAccountModal'

interface Props {
  /**
   * Kept opt-in for the future. It must not be enabled until every
   * first-party learning record can be removed in one audited transaction.
   */
  deletionAvailable?: boolean
  onDeleteAccount?: () => Promise<void>
}

export default function DangerZoneCard({ deletionAvailable = false, onDeleteAccount }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const canDelete = deletionAvailable && typeof onDeleteAccount === 'function'

  return (
    <div className="rounded-2xl border border-red-100 bg-white p-5">
      <div className="flex items-center gap-2">
        <Trash2 size={16} className="text-red-500" />
        <h2 className="text-sm font-bold text-[#191B23]">Опасная зона</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-400">
        {canDelete
          ? 'Удаление аккаунта необратимо и удалит весь ваш прогресс.'
          : 'Удаление временно недоступно: сначала переносим все учебные данные в собственную базу, чтобы ничего не потерять.'}
      </p>
      <button
        type="button"
        onClick={() => canDelete && setModalOpen(true)}
        disabled={!canDelete}
        aria-describedby={canDelete ? undefined : 'account-deletion-unavailable'}
        className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent"
      >
        {canDelete ? 'Удалить аккаунт' : 'Удаление скоро'}
      </button>

      {!canDelete && <p id="account-deletion-unavailable" className="mt-2 text-[11px] font-medium text-gray-400">Пока для помощи с аккаунтом обратитесь в поддержку.</p>}

      {modalOpen && onDeleteAccount && (
        <DeleteAccountModal onClose={() => setModalOpen(false)} onConfirm={onDeleteAccount} />
      )}
    </div>
  )
}
