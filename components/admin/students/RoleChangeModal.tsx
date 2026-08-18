'use client'

import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'

import {
  ACCOUNT_ROLE_LABELS,
  changeAdminAccountRole,
  type AccountRole,
  type AdminAccount,
} from '@/lib/admin-account-client'

interface Props {
  account: AdminAccount
  allowedRoles: AccountRole[]
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const STUDENT_TYPES = [
  { value: 'online', label: 'Онлайн' },
  { value: 'offline', label: 'Оффлайн' },
] as const

function initialStudentType(value: string | null): (typeof STUDENT_TYPES)[number]['value'] {
  return STUDENT_TYPES.some(option => option.value === value)
    ? value as (typeof STUDENT_TYPES)[number]['value']
    : 'online'
}

/** A super-admin-only role change. The API remains the authorization source. */
export default function RoleChangeModal({ account, allowedRoles, onClose, onSaved }: Props) {
  const [role, setRole] = useState<AccountRole>(account.role)
  const [studentType, setStudentType] = useState(() => initialStudentType(account.studentType))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isStudent = role === 'student'

  const handleSubmit = async () => {
    setError('')
    if (!allowedRoles.includes(role)) {
      setError('У вас нет права назначать эту роль')
      return
    }
    if (role === account.role) {
      setError('Выберите другую роль')
      return
    }

    setSaving(true)
    try {
      await changeAdminAccountRole(account.id, { role, ...(isStudent ? { studentType } : {}) })
      await onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось изменить роль')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="change-role-title" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id="change-role-title" className="text-lg font-bold text-[#191B23]">Изменить роль</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">{account.fullName}. Активные сессии этого аккаунта будут завершены.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="account-new-role" className="mb-1 block text-xs font-semibold text-gray-500">Новая роль</label>
            <select id="account-new-role" value={role} onChange={event => setRole(event.target.value as AccountRole)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20">
              {allowedRoles.map(option => <option key={option} value={option}>{ACCOUNT_ROLE_LABELS[option]}</option>)}
            </select>
          </div>

          {isStudent && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500">Формат обучения</p>
              <div className="flex flex-wrap gap-2">
                {STUDENT_TYPES.map(option => (
                  <button key={option.value} type="button" onClick={() => setStudentType(option.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${studentType === option.value ? 'border-[#1B3F92] bg-[#EEF2FF] text-[#1B3F92]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800">
            Роли супер-администратора нельзя создавать или менять из веб-панели. Для аварийного доступа используйте защищённую серверную инструкцию.
          </p>

          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => void handleSubmit()} disabled={saving}
              className="rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Сохранение...' : 'Сохранить роль'}
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
