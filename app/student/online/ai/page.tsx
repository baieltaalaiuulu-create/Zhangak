'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, BookOpen, BrainCircuit, CalendarCheck, ShieldCheck } from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'

/**
 * AI coaching used to combine a Supabase profile, client-side score data and
 * browser-managed chat history. Those sources are no longer authoritative.
 * Keep the route reachable for a signed-in student, but do not present made-up
 * recommendations or send their study context anywhere until its own
 * first-party API is available.
 */
export default function AiMentorChatPage() {
  const user = useStudentSession()
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Студент'

  return (
    <main className="min-h-[calc(100dvh-64px-env(safe-area-inset-bottom))] bg-[#F4F6FA] px-4 py-7 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-2xl">
        <Link
          href="/student/online"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          На главную
        </Link>

        <div className="mt-4 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
          <div className="border-b border-indigo-100 bg-gradient-to-br from-[#0D1E4A] via-[#1B3F92] to-[#6C3DE0] px-6 py-8 text-white sm:px-9 sm:py-10">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
              <BrainCircuit size={25} aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em] text-blue-100">AI-коуч Zhangak</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{firstName}, AI-коуч готовится</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
              Мы подключаем его только к проверенным данным о твоих уроках и результатах — без вымышленных баллов, ошибок и советов.
            </p>
          </div>

          <div className="space-y-5 p-6 sm:p-9">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Пока персональная беседа недоступна. Начни с урока или тренажёра: так первые подтверждённые результаты появятся в учебном профиле после запуска коуча.
            </div>

            <ul className="space-y-3" aria-label="Что появится в AI-коуче">
              <li className="flex gap-3 rounded-2xl border border-slate-100 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]">
                  <BookOpen size={18} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">Объяснение тем</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">По опубликованным материалам твоего курса.</span>
                </span>
              </li>
              <li className="flex gap-3 rounded-2xl border border-slate-100 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <CalendarCheck size={18} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">План подготовки</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">На основе подтверждённого прогресса, а не предположений.</span>
                </span>
              </li>
            </ul>

            <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold leading-5 text-emerald-800">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              Твои данные не отправляются в старый чат и не используются для расчётов на устройстве.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/student/online/lessons"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Открыть уроки
              </Link>
              <Link
                href="/student/online/practice"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Открыть тренажёр
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
