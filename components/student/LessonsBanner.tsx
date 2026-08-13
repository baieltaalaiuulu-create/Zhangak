import { BookOpen, Flame, Star, Target } from 'lucide-react'

interface Props {
  completed: number
  total: number
  streak: number
  targetScore: number
}

function streakWord(n: number): string {
  return n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'
}

export default function LessonsBanner({ completed, total, streak, targetScore }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const xp = completed * 100

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900"><BookOpen size={20} aria-hidden="true" />Мои уроки</h1>
          <p className="text-sm text-gray-500 mt-1">
            Пройдено <span className="font-bold text-[#1B3F92]">{completed}</span> из {total} уроков
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {streak > 0 && (
            <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full whitespace-nowrap">
              <Flame size={16} aria-hidden="true" />
              {streak} {streakWord(streak)} подряд
            </span>
          )}
          <span className="text-sm font-semibold text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full whitespace-nowrap">
            <Star size={16} aria-hidden="true" />
            {xp} XP
          </span>
          <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap">
            <Target size={16} aria-hidden="true" />
            Цель: {targetScore} баллов
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-500">
          <span>Прогресс курса</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1B3F92] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
