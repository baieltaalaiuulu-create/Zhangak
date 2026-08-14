'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Pencil, Target, Timer } from 'lucide-react'
import GoalModal from './GoalModal'

interface Props {
  firstName: string
  latestScore: number | null
  targetScore: number
  dailyGoalMinutes: number
  ctaHref: string
  onGoalUpdate?: (newGoal: number) => void
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Доброе утро'
  if (hour < 17) return 'Добрый день'
  return 'Добрый вечер'
}

export default function DashboardHeroCard({ firstName, latestScore, targetScore, dailyGoalMinutes, ctaHref, onGoalUpdate }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const greeting = greetingForHour(new Date().getHours())
  const score = latestScore ?? 0
  const remaining = Math.max(0, targetScore - score)
  const readinessPct = targetScore > 0 ? Math.min(100, Math.round((score / targetScore) * 100)) : 0

  const ringRadius = 44
  const circumference = 2 * Math.PI * ringRadius

  const handleGoalSaved = (newGoal: number) => {
    onGoalUpdate?.(newGoal)
    setToast(`Цель обновлена — ${newGoal} баллов`)
    window.setTimeout(() => setToast(null), 3000)
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-white sm:p-8"
        style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 w-full flex-1">
            <h1 className="text-[22px] font-bold sm:text-3xl">{greeting}, {firstName}</h1>
            <p className="mt-2 max-w-md text-sm font-medium text-white/80 sm:text-base">
              Сегодня отличный день для подготовки к ОРТ. Твоя цель близка!
            </p>

            <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm sm:text-sm">
                <Target size={15} aria-hidden="true" />
                {score} → {remaining > 0 ? `${remaining} баллов до цели` : 'цель достигнута!'}
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="rounded-full p-0.5 leading-none text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Изменить личную цель"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm sm:text-sm">
                <Timer size={15} aria-hidden="true" />
                Цель: {dailyGoalMinutes} мин сегодня
              </span>
            </div>

            <a
              href={ctaHref}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#4338CA] shadow-md transition-colors hover:bg-white/90 sm:mt-6 sm:inline-flex sm:w-auto"
            >
              Продолжить обучение
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2 self-center sm:self-auto">
            <div className="relative h-28 w-28 sm:h-32 sm:w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r={ringRadius} fill="none"
                  stroke="#fff" strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - readinessPct / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold leading-none sm:text-3xl">{score}</span>
                <span className="mt-1 text-[10px] font-medium text-white/70">баллов</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-white/85 sm:text-sm">{readinessPct}% Готовности</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <GoalModal
          currentGoal={targetScore}
          onClose={() => setModalOpen(false)}
          onSaved={handleGoalSaved}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg md:bottom-6">
          <CheckCircle2 size={17} className="mr-2 inline-block align-text-bottom" aria-hidden="true" />
          {toast}
        </div>
      )}
    </>
  )
}
