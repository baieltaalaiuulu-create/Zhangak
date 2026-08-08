import Link from 'next/link'
import { getProbability, type University } from '@/lib/universities-data'

interface Props {
  studentScore: number
  universities: University[]
}

const PROBABILITY_STYLE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-red-50 text-red-700',
}

function buildAdvice(studentScore: number, universities: University[]): string {
  const probabilities = universities.map(u => getProbability(studentScore, u.minScore))
  const highCount = probabilities.filter(p => p.level === 'high').length
  const lowOnly = probabilities.every(p => p.level === 'low')

  if (lowOnly) {
    const closest = Math.min(...probabilities.map(p => p.pointsNeeded))
    return `Пока баллов не хватает ни для одного из этих вузов — до ближайшего порога осталось ${closest}. Подтяни слабые темы, и шансы вырастут уже к следующему пробному ОРТ.`
  }
  if (highCount === universities.length) {
    return 'Отличный результат! Ты уверенно проходишь по баллам во все вузы из подборки — можно сосредоточиться на выборе специальности и подготовке документов.'
  }
  return 'У тебя хорошие шансы поступить в часть вузов из подборки уже сейчас. Продолжай готовиться, чтобы расширить список доступных вариантов.'
}

export default function AIRecommendationBar({ studentScore, universities }: Props) {
  const advice = buildAdvice(studentScore, universities)

  return (
    <div className="rounded-2xl border border-[#6C3DE0]/15 p-5 shadow-sm" style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)' }}>
      <div className="flex items-center gap-2 text-sm font-bold text-[#4338CA]">
        🧠 AI Рекомендация
      </div>
      <p className="mt-2 text-sm font-medium text-gray-600">При текущем результате ({studentScore} баллов) вам подходят:</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {universities.map(u => {
          const p = getProbability(studentScore, u.minScore)
          return (
            <Link
              key={u.id}
              href={`/student/online/universities/${u.id}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 ${PROBABILITY_STYLE[p.level]}`}
            >
              {u.shortName} — {p.label}
            </Link>
          )
        })}
      </div>

      <p className="mt-3 text-sm text-gray-600">{advice}</p>

      <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/student/online/practice" className="text-[#4338CA] hover:underline">Что подтянуть ▶</Link>
        <Link href="/student/online/ai" className="text-[#4338CA] hover:underline">Построить план ▶</Link>
      </div>
    </div>
  )
}
