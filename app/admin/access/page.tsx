'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, ClipboardCheck, LoaderCircle, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

import AdminTopbar from '@/components/admin/AdminTopbar'
import { getAdminAudit, type AdminAuditItem } from '@/lib/admin-access-client'
import { ACCOUNT_ROLE_LABELS } from '@/lib/admin-account-client'
import { getCurrentZhangakUser } from '@/lib/zhangak-auth-client'

const ACTION_LABELS: Record<string, string> = {
  bootstrap_super_admin: 'Создан аварийный супер-администратор',
  create_user: 'Создан аккаунт',
  change_user_role: 'Изменена роль аккаунта',
  block_user: 'Заблокирован аккаунт',
  unblock_user: 'Разблокирован аккаунт',
  reset_user_password: 'Сброшен пароль',
  delete_user: 'Удалён аккаунт',
  create_course: 'Создан курс',
  update_course: 'Изменён курс',
  create_lesson: 'Создан урок',
  update_lesson: 'Изменён урок',
  create_group: 'Создана группа',
  update_group: 'Изменена группа',
  assign_group_teacher: 'Назначен преподаватель',
  remove_group_teacher: 'Снят преподаватель',
  assign_group_student: 'Добавлен ученик в группу',
  remove_group_student: 'Ученик исключён из группы',
  create_practice_test: 'Создан тест',
  update_practice_test: 'Изменён тест',
  create_practice_question: 'Создан вопрос',
  update_practice_question: 'Изменён вопрос',
  update_own_profile: 'Пользователь обновил профиль',
  begin_practice_attempt: 'Начата попытка',
  submit_practice_attempt: 'Сдана попытка',
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bishkek',
  }).format(date)
}

function actionLabel(item: AdminAuditItem): string {
  return ACTION_LABELS[item.action] ?? item.action.replaceAll('_', ' ')
}

export default function AdminAccessPage() {
  const router = useRouter()
  const [items, setItems] = useState<AdminAuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const user = await getCurrentZhangakUser()
      if (!user) {
        router.replace('/login')
        return
      }
      if (user.role !== 'super_admin') {
        router.replace('/admin')
        return
      }
      const audit = await getAdminAudit()
      setItems(audit.items)
      setTotal(audit.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить журнал действий')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Доступ и аудит" actionLabel="Обновить" actionIcon={RefreshCw} onAction={() => void load()} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl bg-[#0D1E4A] p-5 text-white shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white"><ShieldCheck size={21} aria-hidden="true" /></span>
              <h2 className="mt-4 text-xl font-black">Контур доступа Zhangak</h2>
              <p className="mt-2 text-sm leading-6 text-blue-100">Этот раздел доступен только супер-администратору. Все изменения ролей и важных учебных данных фиксируются в журнале ниже.</p>
            </div>
            <Link href="/admin/students" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-[#0D1E4A] transition-colors hover:bg-blue-50">
              Управлять аккаунтами <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-label="Матрица ролей">
          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <UsersRound size={20} className="text-[#1B3F92]" aria-hidden="true" />
            <h2 className="mt-3 font-extrabold text-[#0D1E4A]">Администратор</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Управляет курсами, уроками, тестами, группами и аккаунтами учеников.</p>
            <p className="mt-3 text-xs font-semibold text-slate-500">Не видит сотрудников, не назначает роли и не открывает журнал действий.</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <ShieldCheck size={20} className="text-indigo-700" aria-hidden="true" />
            <h2 className="mt-3 font-extrabold text-[#0D1E4A]">Супер-администратор</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Дополнительно создаёт и обслуживает сотрудников, меняет их роли и проводит аудит операций.</p>
            <p className="mt-3 text-xs font-semibold text-indigo-700">Роль super_admin нельзя выдавать, менять или удалять через браузер.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <ClipboardCheck size={20} className="text-amber-700" aria-hidden="true" />
            <h2 className="mt-3 font-extrabold text-[#0D1E4A]">Системная граница</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">VPS, резервные копии, ключи и деплой не управляются из веб-панели.</p>
            <p className="mt-3 text-xs font-semibold text-amber-800">Аварийный super_admin создаётся только защищённой серверной командой.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="font-extrabold text-[#191B23]">Журнал действий</h2>
              <p className="mt-1 text-xs text-gray-500">Последние {items.length} из {total} событий. Технические metadata и содержимое ответов не выводятся.</p>
            </div>
          </div>

          {error && <p role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {loading ? (
            <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-slate-500"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Загрузка журнала…</div>
          ) : items.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm font-medium text-slate-500">Событий пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <tr><th className="px-5 py-3">Когда</th><th className="px-4 py-3">Действие</th><th className="px-4 py-3">Автор</th><th className="px-4 py-3">Объект</th></tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-slate-100 text-slate-600">
                      <td className="whitespace-nowrap px-5 py-3 text-xs">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold text-[#191B23]">{actionLabel(item)}</td>
                      <td className="px-4 py-3">{item.actorName ? `${item.actorName} · ${ACCOUNT_ROLE_LABELS[item.actorRole!]}` : 'Удалённый аккаунт'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.targetType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
