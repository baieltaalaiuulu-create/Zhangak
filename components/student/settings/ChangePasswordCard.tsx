'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  email: string
}

const MIN_PASSWORD_LENGTH = 6

export default function ChangePasswordCard({ email }: Props) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setSaving(true)

    // Supabase has no "verify current password" call — reauthenticating with
    // it is the standard way to confirm it before allowing the change.
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: oldPassword })
    if (reauthError) {
      setSaving(false)
      setError('Текущий пароль неверен')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (updateError) {
      setError('Не удалось изменить пароль. Попробуйте снова.')
      return
    }

    setSuccess(true)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-[#1B4FD8]" />
        <h2 className="text-sm font-bold text-[#191B23]">Смена пароля</h2>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="old-password" className="text-xs font-semibold text-gray-500">Текущий пароль</label>
          <input
            id="old-password"
            type="password"
            required
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#191B23] focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="text-xs font-semibold text-gray-500">Новый пароль</label>
          <input
            id="new-password"
            type="password"
            required
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#191B23] focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="text-xs font-semibold text-gray-500">Повторите новый пароль</label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#191B23] focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
          />
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        {success && <p className="text-xs font-semibold text-green-600">Пароль успешно изменён</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Изменить пароль'}
        </button>
      </form>
    </div>
  )
}
