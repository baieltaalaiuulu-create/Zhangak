'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import StudentFormModal from '@/components/admin/students/StudentFormModal'
import ResetPasswordModal from '@/components/admin/students/ResetPasswordModal'
import StudentActionsMenu from '@/components/admin/students/StudentActionsMenu'
import {
  ACCOUNT_ROLE_LABELS,
  creatableAccountRoles,
  deleteAdminAccount,
  listAdminAccounts,
  setAdminAccountBlocked,
  type AccountRole,
  type AdminAccount,
} from '@/lib/admin-account-client'
import { getCurrentZhangakUser } from '@/lib/zhangak-auth-client'

const ROLE_BADGE_COLORS: Partial<Record<AccountRole, string>> = {
  student: 'bg-blue-50 text-blue-700',
  teacher: 'bg-violet-50 text-violet-700',
  admin_jr: 'bg-amber-50 text-amber-700',
  admin: 'bg-indigo-50 text-indigo-700',
  super_admin: 'bg-slate-900 text-white',
}

function formatCreatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function displayError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Не удалось выполнить действие. Повторите попытку.'
}

export default function AdminStudentsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [total, setTotal] = useState(0)
  const [actorId, setActorId] = useState<string | null>(null)
  const [actorRole, setActorRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AccountRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [result, currentUser] = await Promise.all([
        listAdminAccounts({ limit: 100 }),
        getCurrentZhangakUser(),
      ])
      setAccounts(result.items)
      setTotal(result.total)
      setActorId(currentUser?.id ?? null)
      setActorRole(currentUser?.role ?? null)
    } catch (cause) {
      setError(displayError(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  const reload = () => {
    setLoading(true)
    setError('')
    void load()
  }

  useEffect(() => {
    // The page already renders a loading state. Deferring this browser fetch
    // avoids a synchronous state cascade during effect setup.
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const creatableRoles = useMemo(() => creatableAccountRoles(actorRole), [actorRole])
  const visibleRoles = useMemo(() => Array.from(new Set(accounts.map(account => account.role))), [accounts])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter(account => {
      if (query && ![account.fullName, account.email, account.phone ?? ''].some(value => value.toLowerCase().includes(query))) return false
      if (roleFilter !== 'all' && account.role !== roleFilter) return false
      if (statusFilter === 'active' && account.blocked) return false
      if (statusFilter === 'blocked' && !account.blocked) return false
      return true
    })
  }, [accounts, roleFilter, search, statusFilter])

  const stats = useMemo(() => ({
    total,
    active: accounts.filter(account => !account.blocked).length,
    blocked: accounts.filter(account => account.blocked).length,
    students: accounts.filter(account => account.role === 'student').length,
  }), [accounts, total])

  const handleToggleBlock = async (account: AdminAccount) => {
    setBusyAccountId(account.id)
    setError('')
    try {
      await setAdminAccountBlocked(account.id, !account.blocked)
      await load()
    } catch (cause) {
      setError(displayError(cause))
    } finally {
      setBusyAccountId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await deleteAdminAccount(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (cause) {
      setError(displayError(cause))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar
        title="Пользователи"
        actionLabel={creatableRoles.length > 0 ? 'Добавить пользователя' : undefined}
        actionIcon={Plus}
        onAction={creatableRoles.length > 0 ? () => setCreateOpen(true) : undefined}
      />

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#191B23]">Учётные записи</h2>
            <p className="mt-1 text-sm text-gray-500">Данные аккаунтов, пароли и блокировка управляются через собственный API Zhangak.</p>
          </div>
          <button type="button" onClick={reload} disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 sm:self-auto">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Обновить
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Всего доступно', value: stats.total, color: '#1B4FD8' },
            { label: 'Активны', value: stats.active, color: '#10B981' },
            { label: 'Заблокированы', value: stats.blocked, color: '#EF4444' },
            { label: 'Ученики', value: stats.students, color: '#7C3AED' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-2xl font-extrabold" style={{ color: card.color }}>{card.value}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">{card.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск: имя, email или телефон"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as 'all' | AccountRole)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="all">Все роли</option>
            {visibleRoles.map(role => <option key={role} value={role}>{ACCOUNT_ROLE_LABELS[role]}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | 'active' | 'blocked')}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="blocked">Заблокированные</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Пользователь</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Роль</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Телефон</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Детали</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Создан</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Статус</th>
                <th className="w-10 px-3 py-3"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Загрузка пользователей...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Пользователи не найдены</td></tr>
              ) : filtered.map((account, index) => (
                <tr key={account.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${index % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white">
                        {account.fullName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#191B23]">{account.fullName}</div>
                        <div className="truncate text-xs text-gray-400">{account.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ROLE_BADGE_COLORS[account.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ACCOUNT_ROLE_LABELS[account.role]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-500">{account.phone || '—'}</td>
                  <td className="px-3 py-3 text-gray-500">
                    {account.role === 'student' ? `${account.studentType === 'online' ? 'Онлайн' : account.studentType === 'both' ? 'Онлайн и оффлайн' : 'Оффлайн'} · цель ${account.targetScore ?? '—'}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{formatCreatedAt(account.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${account.blocked ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                      {account.blocked ? 'Заблокирован' : 'Активен'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StudentActionsMenu
                      blocked={account.blocked}
                      disabled={busyAccountId === account.id || account.id === actorId || account.role === 'super_admin'}
                      onResetPassword={() => setResetTarget(account)}
                      onToggleBlock={() => void handleToggleBlock(account)}
                      onDelete={() => setDeleteTarget(account)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > accounts.length && (
          <p className="text-xs font-medium text-gray-400">Показаны первые {accounts.length} из {total} доступных аккаунтов.</p>
        )}
        <p className="text-xs text-gray-400">Курсы и учебные группы уже работают через собственную базу Zhangak. Платёжный контур подключается отдельным этапом.</p>
      </div>

      {createOpen && (
        <StudentFormModal
          allowedRoles={creatableRoles}
          onClose={() => setCreateOpen(false)}
          onSaved={load}
        />
      )}
      {resetTarget && <ResetPasswordModal account={resetTarget} onClose={() => setResetTarget(null)} onSaved={() => { void load() }} />}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление аккаунта"
          message={`Удалить аккаунт «${deleteTarget.fullName}»? Это действие необратимо.`}
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
