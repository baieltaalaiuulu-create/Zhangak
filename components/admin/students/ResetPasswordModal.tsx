'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { resetAdminAccountPassword, type AdminAccount } from '@/lib/admin-account-client'

interface Props {
  account: AdminAccount
  onClose: () => void
  onSaved: () => void
}

const MIN_PASSWORD_LENGTH = 10

export default function ResetPasswordModal({ account, onClose, onSaved }: Props) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`); return }

    setSaving(true)
    try {
      await resetAdminAccountPassword(account.id, password)
      setSuccess(true)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#191B23]">Сбросить пароль</h2>
            <p className="text-xs text-gray-400">{account.fullName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-600">
              Пароль успешно изменён
            </div>
            <button type="button" onClick={onClose}
              className="w-full rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Закрыть
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Новый пароль *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={`Мин. ${MIN_PASSWORD_LENGTH} символов`}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" onClick={onClose}
                className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
