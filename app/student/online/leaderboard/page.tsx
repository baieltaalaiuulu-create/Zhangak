'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, BookOpenCheck, ShieldCheck, Trophy, UsersRound } from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'

/**
 * The former ranking was assembled in the browser from retired Supabase data.
 * A ranking needs trusted, server-scored attempts and privacy rules before it
 * can show other students. Do not show stale or fabricated positions during
 * the migration.
 */
export default function LeaderboardPage() {
  const user = useStudentSession()
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Студент'

  return (
    <main className="min-h-screen bg-[#FAF8FF] px-4 py-6 sm:px-6">
      <section className="mx-auto w-full max-w-3xl">
        <Link
          href="/student/online"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          На главную
        </Link>

        <div className="mt-4 rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Trophy size={28} aria-hidden="true" />
          </span>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-amber-700">Рейтинг Zhangak</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{firstName}, честный рейтинг готовится</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Мы переносим подсчёт результатов на защищённый сервер. Пока нельзя надёжно сравнить попытки, мы не покажем неточные места, баллы или чужие данные.
          </p>

          <div className="mx-auto mt-7 grid max-w-xl gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-4">
              <BookOpenCheck size={20} className="text-[#1B3F92]" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-bold text-slate-900">Только проверенные попытки</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">Баллы будут считаться на сервере после завершения теста.</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4">
              <UsersRound size={20} className="text-violet-700" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-bold text-slate-900">Понятные правила</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">Перед запуском появятся правила периода и отображения участников.</p>
            </div>
          </div>

          <p className="mx-auto mt-5 flex max-w-xl items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-left text-xs font-semibold leading-5 text-emerald-800">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            Старые клиентские расчёты и данные другого пользователя отключены.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href="/student/online/practice"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              Открыть тренажёр
            </Link>
            <Link
              href="/student/online/lessons"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Открыть уроки
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
