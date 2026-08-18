'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  ClipboardCheck,
  Download,
  FilePlus2,
  FileText,
  History,
  PenLine,
  RefreshCw,
  Users,
  UserPlus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  getAdminDashboard,
  type AdminDashboard,
  type AdminDashboardAuditAction,
  type AdminDashboardAttemptType,
} from '@/lib/admin-dashboard-client'
import { ZhangakApiError } from '@/lib/zhangak-api-client'

const ATTEMPT_LABELS: Record<AdminDashboardAttemptType, string> = {
  practice: 'Тренажёр',
  mock: 'Пробный ОРТ',
  bank: 'Банк заданий',
  diagnostic: 'Диагностика',
}

const AUDIT_LABELS: Record<AdminDashboardAuditAction, string> = {
  create_user: 'Создан пользователь',
  block_user: 'Пользователь заблокирован',
  unblock_user: 'Пользователь разблокирован',
  reset_user_password: 'Пароль пользователя обновлён',
  delete_user: 'Пользователь удалён',
  create_course: 'Создан курс',
  update_course: 'Курс обновлён',
  create_lesson: 'Создан урок',
  update_lesson: 'Урок обновлён',
}

function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} дн назад`
}

function todayLabel(): string {
  const label = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function MetricCard({ label, value, hint, icon: Icon, tone }: {
  label: string
  value: number
  hint: string
  icon: typeof Users
  tone: 'blue' | 'green' | 'violet' | 'amber'
}) {
  const tones = {
    blue: 'bg-blue-50 text-[#1B3F92]',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={20} aria-hidden="true" /></span>
      <p className="mt-4 text-2xl font-extrabold text-[#191B23]">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-700">{label}</h2>
      <p className="mt-2 text-xs font-medium text-slate-400">{hint}</p>
    </article>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-52 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white" />)}
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-white" />
    </div>
  )
}

function ErrorState({ error, onRetry, onLogin }: { error: ZhangakApiError | null; onRetry: () => Promise<void>; onLogin: () => void }) {
  const loginRequired = error?.status === 401 || error?.status === 403
  const description = loginRequired
    ? 'Сессия администратора не найдена или больше не действует. Войдите снова.'
    : error?.message ?? 'Не удалось загрузить сводку из собственной базы Zhangak.'

  return (
    <section className="mx-auto max-w-md rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={24} aria-hidden="true" /></span>
      <h2 className="mt-4 text-lg font-black text-[#191B23]">Сводка не загрузилась</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-5 flex justify-center gap-3">
        {loginRequired
          ? <button type="button" onClick={onLogin} className="inline-flex min-h-11 items-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white">Войти</button>
          : <button type="button" onClick={() => void onRetry()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white"><RefreshCw size={17} aria-hidden="true" />Повторить</button>}
      </div>
    </section>
  )
}

function exportStats(dashboard: AdminDashboard) {
  const rows = [
    ['Метрика', 'Значение'],
    ['Всего учеников', String(dashboard.metrics.totalStudents)],
    ['Новые ученики за 7 дней', String(dashboard.metrics.newStudentsLast7Days)],
    ['Уроков в программе', String(dashboard.metrics.lessonCount)],
    ['Новые уроки за 7 дней', String(dashboard.metrics.newLessonsLast7Days)],
    ['Сдано попыток', String(dashboard.metrics.submittedAttemptCount)],
    ['Сдано попыток сегодня', String(dashboard.metrics.submittedAttemptCountToday)],
  ]
  const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `zhangak-dashboard-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ZhangakApiError | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDashboard(await getAdminDashboard())
    } catch (cause) {
      setError(cause instanceof ZhangakApiError
        ? cause
        : new ZhangakApiError('Сервис вернул некорректную сводку', 502, 'invalid_admin_dashboard'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const metrics = dashboard?.metrics

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Обзор" />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-[#191B23]">Сегодня</h1>
            <p className="mt-1 text-sm text-slate-400">{todayLabel()}</p>
          </div>
          {dashboard && <button type="button" onClick={() => exportStats(dashboard)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:border-[#1B3F92]/30 hover:text-[#1B3F92]"><Download size={17} aria-hidden="true" />Экспорт CSV</button>}
        </div>

        {loading && !dashboard ? <LoadingState /> : !dashboard ? <ErrorState error={error} onRetry={load} onLogin={() => router.replace('/login')} /> : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Метрики платформы">
              <MetricCard label="Всего учеников" value={metrics!.totalStudents} hint={`${metrics!.newStudentsLast7Days} новых за 7 дней`} icon={Users} tone="blue" />
              <MetricCard label="Уроков в программе" value={metrics!.lessonCount} hint={`${metrics!.newLessonsLast7Days} добавлено за 7 дней`} icon={BookOpen} tone="violet" />
              <MetricCard label="Сдано попыток" value={metrics!.submittedAttemptCount} hint="Все завершённые попытки" icon={ClipboardCheck} tone="green" />
              <MetricCard label="Сдано сегодня" value={metrics!.submittedAttemptCountToday} hint="По времени Бишкек" icon={PenLine} tone="amber" />
            </section>

            <section className="grid gap-4 lg:grid-cols-3" aria-label="Быстрые действия">
              <Link href="/admin/lessons/new" className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1B3F92]/30 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><FilePlus2 size={18} aria-hidden="true" /></span>
                <span><span className="block text-sm font-bold text-[#191B23]">Добавить урок</span><span className="mt-1 block text-xs text-slate-400">В собственную программу</span></span>
              </Link>
              <Link href="/admin/lessons" className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white"><FileText size={18} aria-hidden="true" /></span>
                <span><span className="block text-sm font-bold text-[#191B23]">Управлять программой</span><span className="mt-1 block text-xs text-slate-400">Курсы и публикация уроков</span></span>
              </Link>
              <Link href="/admin/students" className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white"><UserPlus size={18} aria-hidden="true" /></span>
                <span><span className="block text-sm font-bold text-[#191B23]">Ученики</span><span className="mt-1 block text-xs text-slate-400">Аккаунты переносятся поэтапно</span></span>
              </Link>
            </section>

            {!dashboard.availability.dailyActiveStudents && !dashboard.availability.payments && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                <div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-amber-700" size={20} aria-hidden="true" /><div><h2 className="font-black">Показываем только подтверждённые данные</h2><p className="mt-1 text-sm leading-6">Дневная активность и платежи пока не выводятся: в нашем backend ещё нет отдельного журнала событий и платежного модуля. Поэтому на панели нет вымышленных нулей или старых данных.</p></div></div>
              </section>
            )}

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><ClipboardCheck size={18} className="text-[#1B3F92]" aria-hidden="true" /><h2 className="text-sm font-black text-[#191B23]">Последние сданные попытки</h2></div>
                {dashboard.recentAttempts.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">Пока нет сданных попыток в собственной базе.</p> : <ul>
                  {dashboard.recentAttempts.map((attempt, index) => <li key={attempt.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${index < dashboard.recentAttempts.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-[#191B23]">{attempt.studentName}</p><p className="mt-1 truncate text-xs text-slate-400">{ATTEMPT_LABELS[attempt.testType]} · {attempt.testTitle}</p></div>
                    <div className="shrink-0 text-right"><p className="text-sm font-black text-[#1B3F92]">{attempt.scorePercent}%</p><p className="mt-1 text-xs text-slate-400">{timeAgo(attempt.completedAt)}</p></div>
                  </li>)}
                </ul>}
              </article>

              {dashboard.availability.auditFeed ? (
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><History size={18} className="text-violet-600" aria-hidden="true" /><h2 className="text-sm font-black text-[#191B23]">Последние изменения</h2></div>
                  {dashboard.recentChanges.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">Изменений в собственной базе пока нет.</p> : <ul>
                    {dashboard.recentChanges.map((change, index) => <li key={change.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${index < dashboard.recentChanges.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <p className="min-w-0 truncate text-sm font-semibold text-[#191B23]">{AUDIT_LABELS[change.action]}</p>
                      <p className="shrink-0 text-xs text-slate-400">{timeAgo(change.createdAt)}</p>
                    </li>)}
                  </ul>}
                </article>
              ) : (
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><History size={18} className="text-violet-600" aria-hidden="true" /><h2 className="text-sm font-black text-[#191B23]">Журнал действий</h2></div>
                  <p className="p-8 text-center text-sm leading-6 text-slate-400">Журнал действий и управление ролями доступны только супер-администратору.</p>
                </article>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
