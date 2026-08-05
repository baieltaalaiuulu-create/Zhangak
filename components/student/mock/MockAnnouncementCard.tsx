import Link from 'next/link'
import { FileQuestion, Clock, Trophy, ListChecks } from 'lucide-react'
import type { MockTest } from '@/lib/mock-data'

interface Props {
  test: MockTest
  questionCount: number
  attemptsLeft: number | null // null = unlimited
  cta: { label: string; href: string }
}

export default function MockAnnouncementCard({ test, questionCount, attemptsLeft, cta }: Props) {
  const durationLabel = test.time_limit_minutes ? `${test.time_limit_minutes} мин` : '—'

  const infoCards = [
    { icon: FileQuestion, label: 'Вопросов', value: String(questionCount) },
    { icon: Clock, label: 'Время', value: durationLabel },
    { icon: Trophy, label: 'Рейтинг', value: 'После теста' },
    { icon: ListChecks, label: 'Разбор ошибок', value: 'После теста' },
  ]

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-6 sm:p-8 text-white shadow-sm"
        style={{ background: 'linear-gradient(135deg, #1B4FD8 0%, #3B82F6 100%)' }}
      >
        <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
          Пробный ОРТ
        </span>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{test.title}</h1>
        <p className="mt-2 text-sm text-blue-100">
          Полный формат экзамена — математика, кыргыз тили, аналогия и чтение.
        </p>

        <Link
          href={cta.href}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#1B4FD8] shadow-md transition-colors hover:bg-blue-50"
        >
          {cta.label}
        </Link>

        {attemptsLeft !== null && (
          <p className="mt-3 text-xs text-blue-100">
            {attemptsLeft > 0 ? `Осталось попыток: ${attemptsLeft}` : 'Попытки закончились'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {infoCards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <Icon size={18} className="text-[#1B4FD8]" />
              <div className="mt-2 text-sm font-bold text-[#191B23]">{c.value}</div>
              <div className="text-xs text-gray-400">{c.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
