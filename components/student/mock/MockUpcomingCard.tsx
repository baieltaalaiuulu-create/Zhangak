import { CalendarClock, Users, Check } from 'lucide-react'
import CountdownTimer from './CountdownTimer'
import type { MockTest } from '@/lib/mock-data'

interface Props {
  test: MockTest
  registered: boolean
  registeredCount: number
  registering: boolean
  onRegister: () => void
  onCountdownComplete: () => void
}

export default function MockUpcomingCard({
  test, registered, registeredCount, registering, onRegister, onCountdownComplete,
}: Props) {
  const scheduledLabel = test.scheduled_at
    ? new Date(test.scheduled_at).toLocaleString('ru', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div
      className="rounded-2xl p-6 text-white shadow-sm sm:p-8"
      style={{ background: 'linear-gradient(135deg, #1B4FD8 0%, #3B82F6 100%)' }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
        <CalendarClock size={13} /> Скоро пробный ОРТ
      </span>
      <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{test.title}</h1>
      <p className="mt-2 text-sm text-blue-100">{scheduledLabel}</p>

      <div className="mt-5">
        <CountdownTimer targetIso={test.scheduled_at as string} onComplete={onCountdownComplete} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {registered ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white">
            <Check size={16} /> Вы зарегистрированы
          </span>
        ) : (
          <button
            type="button"
            onClick={onRegister}
            disabled={registering}
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#1B4FD8] shadow-md transition-colors hover:bg-blue-50 disabled:opacity-60"
          >
            {registering ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        )}
        <span className="flex items-center gap-1.5 text-sm text-blue-100">
          <Users size={15} /> Записалось: {registeredCount}
        </span>
      </div>
    </div>
  )
}
