'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, BookOpen, ShieldCheck, Wrench } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'

/**
 * The old question editor read and wrote legacy data tables directly,
 * including answer keys.  The new API intentionally does not expose question
 * CRUD until its server-side validation and audit trail are ready.  Keep this
 * mounted route explicit rather than silently falling back to the legacy
 * editor or creating an empty local-only form.
 */
export default function AdminLessonQuestionsMigrationPage() {
  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Задания урока" />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin/lessons" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gray-500 hover:bg-white hover:text-[#1B3F92]">
          <ArrowLeft size={16} aria-hidden="true" /> Назад к курсам и урокам
        </Link>

        <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Wrench size={26} aria-hidden="true" /></span>
          <h1 className="mt-5 text-xl font-black text-[#191B23]">Редактор заданий переносится</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600">Новый backend уже управляет курсами и уроками. Редактор вопросов пока не включён: он должен хранить ключи ответов только на сервере, проверять структуру вариантов и вести аудит изменений.</p>

          <div className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-4">
              <BookOpen size={19} className="text-[#1B3F92]" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-[#0D1E4A]">Можно делать сейчас</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Создавать уроки, прикреплять материал и публиковать готовую программу.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <ShieldCheck size={19} className="text-emerald-700" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-emerald-900">Что будет дальше</p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">Защищённый API для заданий, тестов и проверки без выдачи ответов ученику.</p>
            </div>
          </div>

          <Link href="/admin/lessons" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white hover:bg-blue-700">Вернуться к урокам</Link>
        </section>
      </main>
    </div>
  )
}
