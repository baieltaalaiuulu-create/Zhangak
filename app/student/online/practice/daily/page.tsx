import Link from 'next/link'
import { ArrowLeft, CalendarClock, ShieldCheck } from 'lucide-react'

// Daily XP and leaderboard updates must be finalized atomically by the
// first-party API. The retired Supabase page let the browser award XP, so it
// is deliberately unavailable until the trusted daily-attempt slice ships.
export default function DailyChallengeFlowPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#F4F6FA] px-4 py-8">
      <section className="w-full max-w-xl rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:p-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#1B3F92]">
          <CalendarClock size={28} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-gray-900">Задание дня готовится</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Мы переносим ежедневные задания на защищённый сервер Zhangak, чтобы результаты, XP и рейтинг считались честно и сохранялись один раз.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <ShieldCheck size={16} aria-hidden="true" />
          Старый небезопасный способ начисления отключён.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/student/online/practice"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            Открыть тренажёр
          </Link>
          <Link
            href="/student/online"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            На главную
          </Link>
        </div>
      </section>
    </main>
  )
}
