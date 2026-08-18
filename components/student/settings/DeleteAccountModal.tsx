'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  onClose: () => void
  onConfirm: () => Promise<void>
}

const CONFIRM_PHRASE = 'УДАЛИТЬ'

export default function DeleteAccountModal({ onClose, onConfirm }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE

  const handleConfirm = async () => {
    if (!canConfirm) return
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить аккаунт. Попробуйте снова.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle size={20} />
        </div>
        <h2 id="delete-account-title" className="mt-3 text-lg font-bold text-[#191B23]">Удалить аккаунт?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Это действие необратимо. Весь ваш прогресс, результаты тестов и личные данные будут удалены безвозвратно.
        </p>

        <label htmlFor="confirm-delete" className="mt-4 block text-xs font-semibold text-gray-500">
          Введите «{CONFIRM_PHRASE}», чтобы подтвердить
        </label>
        <input
          id="confirm-delete"
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#191B23] focus:outline-none focus:ring-2 focus:ring-red-200"
        />

        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || deleting}
            className="rounded-xl bg-red-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Удаление…' : 'Удалить аккаунт'}
          </button>
        </div>
      </div>
    </div>
  )
}
