import Link from 'next/link'
import type { NextMockInfo } from '@/lib/ai-chat-panel-data'

interface Props {
  info: NextMockInfo
}

export default function NextMockCard({ info }: Props) {
  if (info.status === 'none') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Следующий пробный ОРТ</p>
        <p className="mt-2 text-xs text-gray-400">Пока не запланирован</p>
      </div>
    )
  }

  const dateLabel = info.scheduledAt
    ? new Date(info.scheduledAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
    : 'Доступен'

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Следующий пробный ОРТ</p>
      <p className="mt-1.5 text-2xl font-extrabold text-amber-900">{dateLabel}</p>
      <p className="mt-0.5 text-xs font-semibold text-amber-700">
        {info.status === 'live' ? 'Идёт сейчас' : info.daysRemaining != null ? `Осталось ~${info.daysRemaining} дней` : 'Открыт для прохождения'}
      </p>
      <Link
        href="/student/online/mock"
        className="mt-3 block w-full rounded-xl bg-amber-500 py-2 text-center text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
      >
        Начать подготовку
      </Link>
    </div>
  )
}
