'use client'

interface Props {
  firstName: string
  todayGoalLabel: string
  targetScore: number
  remaining: number
  probabilityPct: number
  minutesTodayLabel: string
  tasksDoneToday: number
  tasksGoalToday: number
  latestMockScore: number | null
  continueHref: string
  onReviewErrors: () => void
}

export default function ChatHeroCard({
  firstName, todayGoalLabel, targetScore, remaining, probabilityPct, minutesTodayLabel,
  tasksDoneToday, tasksGoalToday, latestMockScore, continueHref, onReviewErrors,
}: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-white sm:p-7"
      style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div className="relative">
        <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">
          AI Mentor · Персональный наставник
        </span>

        <h1 className="mt-3 text-2xl font-bold">Привет, {firstName}! 👋</h1>
        {todayGoalLabel && (
          <p className="mt-1 text-base font-bold text-white/95">Сегодняшняя цель: {todayGoalLabel}</p>
        )}

        <p className="mt-2 text-sm text-white/75">
          До цели ({targetScore} баллов) осталось {remaining} баллов • Готовность: {probabilityPct}%
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm">
          <div>
            <div className="text-base font-extrabold">{minutesTodayLabel}</div>
            <div className="text-[10px] text-white/60">Сегодня</div>
          </div>
          <div>
            <div className="text-base font-extrabold">{tasksDoneToday}/{tasksGoalToday}</div>
            <div className="text-[10px] text-white/60">Задач</div>
          </div>
          <div>
            <div className="text-base font-extrabold">{latestMockScore ?? '—'}</div>
            <div className="text-[10px] text-white/60">Последний ОРТ</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={continueHref}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#4338CA] shadow-md transition-colors hover:bg-white/90"
          >
            Начать обучение →
          </a>
          <button
            type="button"
            onClick={onReviewErrors}
            className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            Разобрать ошибки
          </button>
        </div>
      </div>
    </div>
  )
}
