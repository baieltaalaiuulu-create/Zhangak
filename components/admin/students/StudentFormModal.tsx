'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  ACCOUNT_ROLE_LABELS,
  createAdminAccount,
  type AccountRole,
} from '@/lib/admin-account-client'

interface Props {
  allowedRoles: AccountRole[]
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const STUDENT_TYPES = [
  { value: 'online', label: 'Онлайн' },
  { value: 'offline', label: 'Оффлайн' },
  { value: 'both', label: 'Онлайн и оффлайн' },
] as const

const MIN_PASSWORD_LENGTH = 10
const MIN_TARGET_SCORE = 0
const MAX_TARGET_SCORE = 245

function initialRole(allowedRoles: AccountRole[]): AccountRole {
  return allowedRoles.includes('student') ? 'student' : (allowedRoles[0] ?? 'student')
}

/** Account creation modal backed exclusively by the first-party /v1/admin API. */
export default function StudentFormModal({ allowedRoles, onClose, onSaved }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<AccountRole>(() => initialRole(allowedRoles))
  const [studentType, setStudentType] = useState<(typeof STUDENT_TYPES)[number]['value']>('online')
  const [targetScore, setTargetScore] = useState(180)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isStudent = role === 'student'

  const handleSubmit = async () => {
    setError('')

    if (!allowedRoles.includes(role)) {
      setError('У вас нет права создавать аккаунт с этой ролью')
      return
    }
    if (!fullName.trim()) {
      setError('Введите ФИО')
      return
    }
    if (!email.trim()) {
      setError('Введите email')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`)
      return
    }
    if (isStudent && (targetScore < MIN_TARGET_SCORE || targetScore > MAX_TARGET_SCORE)) {
      setError(`Целевой балл должен быть в диапазоне ${MIN_TARGET_SCORE}–${MAX_TARGET_SCORE}`)
      return
    }

    setSaving(true)
    try {
      await createAdminAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(isStudent ? { studentType, targetScore } : {}),
      })
      await onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать аккаунт')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#191B23]">Новый пользователь</h2>
            <p className="mt-1 text-xs text-gray-400">Учётная запись создаётся в собственной базе Zhangak.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="account-full-name" className="mb-1 block text-xs font-semibold text-gray-500">ФИО *</label>
            <input id="account-full-name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Иванов Айбек"
              autoComplete="name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
          </div>

          <div>
            <label htmlFor="account-role" className="mb-1 block text-xs font-semibold text-gray-500">Роль *</label>
            <select id="account-role" value={role} onChange={event => setRole(event.target.value as AccountRole)} disabled={allowedRoles.length <= 1}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20 disabled:cursor-not-allowed disabled:bg-gray-50">
              {allowedRoles.map(option => <option key={option} value={option}>{ACCOUNT_ROLE_LABELS[option]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="account-email" className="mb-1 block text-xs font-semibold text-gray-500">Email *</label>
              <input id="account-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="user@gmail.com"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
            </div>
            <div>
              <label htmlFor="account-password" className="mb-1 block text-xs font-semibold text-gray-500">Временный пароль *</label>
              <input id="account-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={`Мин. ${MIN_PASSWORD_LENGTH} символов`}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
            </div>
          </div>

          <div>
            <label htmlFor="account-phone" className="mb-1 block text-xs font-semibold text-gray-500">Телефон</label>
            <input id="account-phone" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+996 700 000 000"
              autoComplete="tel"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
          </div>

          {isStudent && (
            <>
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-500">Формат обучения *</p>
                <div className="flex flex-wrap gap-2">
                  {STUDENT_TYPES.map(option => (
                    <button key={option.value} type="button" onClick={() => setStudentType(option.value)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${studentType === option.value ? 'border-[#1B3F92] bg-[#EEF2FF] text-[#1B3F92]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="account-target-score" className="mb-1 block text-xs font-semibold text-gray-500">Целевой балл</label>
                <input id="account-target-score" type="number" min={MIN_TARGET_SCORE} max={MAX_TARGET_SCORE} value={targetScore}
                  onChange={event => setTargetScore(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
            </>
          )}

          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving || allowedRoles.length === 0}
              className="rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Создание...' : 'Создать аккаунт'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
