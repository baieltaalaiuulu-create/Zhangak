'use client'

import Image from 'next/image'
import {
  BookOpen,
  CalendarDays,
  CircleAlert,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { logoutZhangak } from '@/lib/zhangak-auth-client'
import type { PlatformTeacherDashboard, PlatformTeacherGroup } from '@/lib/platform-teacher'

interface Props {
  dashboard: PlatformTeacherDashboard
  onRefresh: () => Promise<void>
  refreshing: boolean
}

function formatDate(value: string | null): string {
  if (!value) return 'Не назначено'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Не назначено'
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
}

function deliveryModeLabel(value: PlatformTeacherGroup['deliveryMode']): string {
  if (value === 'online') return 'Онлайн'
  if (value === 'hybrid') return 'Смешанный'
  return 'Очно'
}

function GroupCard({ group }: { group: PlatformTeacherGroup }) {
  const courseDetails = [group.course.subject, group.course.level].filter((value): value is string => Boolean(value))

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Моя группа</p>
          <h2 className="mt-1 break-words text-xl font-black text-slate-950">{group.name}</h2>
          <p className="mt-2 break-words text-sm font-semibold text-[#1B3F92]">{group.course.name}</p>
          {courseDetails.length > 0 && <p className="mt-1 text-sm text-slate-500">{courseDetails.join(' • ')}</p>}
        </div>
        <span className="inline-flex min-h-8 items-center rounded-full bg-blue-50 px-3 text-xs font-bold text-[#1B3F92]">{deliveryModeLabel(group.deliveryMode)}</span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-blue-50 p-4">
          <dt className="flex items-center gap-2 text-xs font-bold text-blue-700"><Users size={16} aria-hidden="true" />Активные ученики</dt>
          <dd className="mt-2 text-3xl font-black text-slate-950">{group.activeStudentCount}</dd>
          <p className="mt-1 text-xs leading-5 text-slate-500">Только количество — личные карточки появятся после отдельной миграции.</p>
        </div>
        <div className="rounded-2xl bg-violet-50 p-4">
          <dt className="flex items-center gap-2 text-xs font-bold text-violet-700"><BookOpen size={16} aria-hidden="true" />Опубликованные уроки</dt>
          <dd className="mt-2 text-3xl font-black text-slate-950">{group.publishedLessonCount}</dd>
          <p className="mt-1 text-xs leading-5 text-slate-500">Счётчик берётся из курса, без подстановки плана занятий.</p>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <p className="inline-flex items-center gap-2"><CalendarDays size={16} aria-hidden="true" />Старт: {formatDate(group.startsOn)}</p>
        <p className="inline-flex items-center gap-2"><Clock3 size={16} aria-hidden="true" />Окончание: {formatDate(group.endsOn)}</p>
      </div>
    </article>
  )
}

function EmptyGroups() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#1B3F92]"><Users size={28} aria-hidden="true" /></span>
      <h2 className="mt-4 text-xl font-black text-slate-950">Нет активных групп</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Когда администратор назначит вам активную группу и курс, она появится здесь. Мы не показываем тестовые или вымышленные данные.</p>
    </section>
  )
}

export default function TeacherWorkspace({ dashboard, onRefresh, refreshing }: Props) {
  const logout = async () => {
    await logoutZhangak().catch(() => {})
    window.location.replace('/login?surface=platform')
  }

  const firstName = dashboard.teacher.fullName.split(' ')[0] || 'Преподаватель'

  return (
    <div className="min-h-screen bg-[#F6F7FB] pb-10">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/images/logo.png" alt="Жангак" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" priority />
            <div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">Жангак • Учитель</p><p className="truncate text-xs text-slate-500">Кабинет преподавателя</p></div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void onRefresh()} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#1B3F92] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Обновить данные">
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /><span className="hidden sm:inline">Обновить</span>
            </button>
            <button type="button" onClick={() => void logout()} aria-label="Выйти" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut size={20} aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl bg-[#0D1E4A] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-sm font-semibold text-blue-100">Здравствуйте, {firstName}</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Ваши учебные группы</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Показываем только назначенные вам активные группы и проверенные счётчики из собственной базы Zhangak.</p></div>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold"><ShieldCheck size={18} aria-hidden="true" />Собственный backend</span>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="flex gap-3"><CircleAlert className="mt-0.5 shrink-0 text-amber-700" size={20} aria-hidden="true" /><div><h2 className="font-black">Журнал и задания переносятся</h2><p className="mt-1 text-sm leading-6">Посещаемость, оценки, домашние задания и карточки учеников пока не отображаются и не принимаются. Они появятся только после отдельной безопасной миграции на наш backend.</p></div></div>
        </section>

        <section className="mt-6" aria-labelledby="teacher-groups-title">
          <div className="mb-4 flex items-center justify-between gap-4"><h2 id="teacher-groups-title" className="text-lg font-black text-slate-950">Назначенные группы</h2><span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-600 shadow-sm">{dashboard.groups.length}</span></div>
          {dashboard.groups.length === 0 ? <EmptyGroups /> : <div className="grid gap-4 lg:grid-cols-2">{dashboard.groups.map(group => <GroupCard key={group.id} group={group} />)}</div>}
        </section>
      </main>
    </div>
  )
}
