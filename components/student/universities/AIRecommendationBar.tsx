import Link from 'next/link'
import { ArrowRight, Compass } from 'lucide-react'
import { type University } from '@/lib/universities-data'
import { getAdmissionProbability } from '@/lib/university-matching'

interface Props {
  studentScore: number | null
  universities: University[]
}

const PROBABILITY_STYLE = {
  high: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-red-50 text-red-700',
  unknown: 'bg-white/70 text-gray-600',
}

function buildAdvice(studentScore: number | null, universities: University[]): string {
  if (universities.length === 0) return 'В каталоге пока нет подходящих вариантов. Попробуй изменить фильтры или вернись позже.'
  if (studentScore == null) {
    return 'Пройди пробный ОРТ — после этого мы сопоставим твой фактический результат с опубликованными проходными баллами.'
  }
  const probabilities = universities.map(u => getAdmissionProbability(studentScore, u.minScore))
  const known = probabilities.filter(p => p.level !== 'unknown')
  if (known.length === 0) return 'В подборке пока нет подтверждённых проходных баллов. Проверь условия на официальных сайтах университетов.'
  const highCount = known.filter(p => p.level === 'high').length
  const lowOnly = known.every(p => p.level === 'low')

  if (lowOnly) {
    const closest = Math.min(...known.map(p => p.pointsNeeded))
    return `Пока баллов не хватает ни для одного из этих вузов — до ближайшего порога осталось ${closest}. Подтяни слабые темы, и шансы вырастут уже к следующему пробному ОРТ.`
  }
  if (highCount === known.length) {
    return 'Отличный результат! Ты уверенно проходишь по баллам во все вузы из подборки — можно сосредоточиться на выборе специальности и подготовке документов.'
  }
  return 'У тебя хорошие шансы поступить в часть вузов из подборки уже сейчас. Продолжай готовиться, чтобы расширить список доступных вариантов.'
}

export default function AIRecommendationBar({ studentScore, universities }: Props) {
  const advice = buildAdvice(studentScore, universities)

  return (
    <div className="rounded-2xl border border-[#6C3DE0]/15 p-5 shadow-sm" style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)' }}>
      <div className="flex items-center gap-2 text-sm font-bold text-[#4338CA]">
        <Compass size={18} aria-hidden="true" />
        Подбор по твоему баллу
      </div>
      <p className="mt-2 text-sm font-medium text-gray-600">
        {studentScore == null ? 'Сейчас показываем варианты по рейтингу каталога.' : `Последний пробный ОРТ: ${studentScore} баллов.`}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {universities.map(u => {
          const p = getAdmissionProbability(studentScore, u.minScore)
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
      <p className="mt-2 text-xs text-gray-500">
        Оценка учитывает только последний пробный балл. Требования, сроки и документы уточняй на официальном сайте вуза.
      </p>

      <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/student/online/mock" className="inline-flex min-h-11 items-center gap-1.5 text-[#4338CA] hover:underline">Пройти пробный ОРТ <ArrowRight size={15} aria-hidden="true" /></Link>
        <Link href="/student/online/ai" className="inline-flex min-h-11 items-center gap-1.5 text-[#4338CA] hover:underline">Открыть AI Коуч <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </div>
  )
}
