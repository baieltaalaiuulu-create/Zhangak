'use client'

import { SECTION_LABELS, type AnswerLetter, type PracticeQuestion } from '@/lib/practice-data'

export interface WrongAnswer {
  question: PracticeQuestion
  selected: AnswerLetter | undefined
}

interface Props {
  score: number
  total: number
  previousScore: number | null
  passed: boolean
  elapsedSeconds: number
  streak: number
  wrongAnswers: WrongAnswer[]
  weakSection: string | null
  projectedScore: number
  nextLessonTitle: string | null
  nextLessonHref: string | null
  onRetry: () => void
  onReview: () => void
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`
}

export default function PracticeResultsScreen({
  score, total, previousScore, passed, elapsedSeconds, streak, wrongAnswers,
  weakSection, projectedScore, nextLessonTitle, nextLessonHref, onRetry, onReview,
}: Props) {
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0
  const xpEarned = score * 10
  const delta = previousScore !== null ? score - previousScore : null

  const handleShare = async () => {
    const text = `Я прошёл практический тест на Zhangak: ${score}/${total} (${accuracy}%)! 🎯`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Hero */}
      <div
        className="rounded-2xl p-6 text-center text-white sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1e50e8 0%, #0f2fa8 60%, #061d70 100%)' }}
      >
        <p className="text-sm font-medium text-blue-200">{passed ? '🎉 Тест пройден!' : 'Тест завершён'}</p>
        <p className="mt-2 text-5xl font-bold leading-none">{score}/{total}</p>
        {delta !== null && delta > 0 && (
          <span className="mt-3 inline-block rounded-full bg-green-400/20 px-3 py-1 text-sm font-semibold text-green-300">
            ▲ Лучше предыдущего на +{delta}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-4 sm:divide-y-0">
          <div className="flex flex-col items-center justify-center gap-0.5 py-4">
            <span className="text-lg font-bold text-yellow-600">⭐ {xpEarned}</span>
            <span className="text-xs text-gray-400">XP</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5 py-4">
            <span className="text-lg font-bold text-gray-900">{formatDuration(elapsedSeconds)}</span>
            <span className="text-xs text-gray-400">время</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5 py-4">
            <span className="text-lg font-bold text-gray-900">{accuracy}%</span>
            <span className="text-xs text-gray-400">точность</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5 py-4">
            <span className="text-lg font-bold text-orange-600">🔥 {streak}</span>
            <span className="text-xs text-gray-400">подряд</span>
          </div>
        </div>
      </div>

      {/* Error list (compact) */}
      {wrongAnswers.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Ошибки ({wrongAnswers.length})</h3>
            <button type="button" onClick={onReview} className="text-xs font-bold text-[#1B4FD8] hover:underline">
              Смотреть разбор →
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {wrongAnswers.slice(0, 3).map(({ question }) => (
              <li key={question.id} className="line-clamp-1 text-sm text-gray-600">
                <span className="text-red-500">✕</span> {question.question_text}
              </li>
            ))}
            {wrongAnswers.length > 3 && (
              <li className="text-xs text-gray-400">и ещё {wrongAnswers.length - 3}...</li>
            )}
          </ul>
        </div>
      )}

      {/* AI card */}
      <div
        className="rounded-2xl p-5 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e2d4e 100%)' }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-blue-300">
          🤖 AI-наставник
        </span>
        {weakSection ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Больше всего ошибок в теме{' '}
            <span className="font-semibold text-white">«{SECTION_LABELS[weakSection] ?? weakSection}»</span>.
            {' '}Стоит потренироваться именно здесь.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Отличный результат — ошибок нет! Продолжай в том же темпе.
          </p>
        )}
        {projectedScore > score && (
          <p className="mt-3 text-2xl font-bold text-orange-400">
            {score} → {projectedScore} <span className="text-sm font-medium text-slate-400">баллов в следующий раз</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {nextLessonHref && (
          <a
            href={nextLessonHref}
            className="flex-1 rounded-xl bg-[#1B4FD8] py-3 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
          >
            {nextLessonTitle ? `Следующий урок: ${nextLessonTitle}` : 'Следующий урок'}
          </a>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-center text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Повторить тест
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-center text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Поделиться
        </button>
      </div>
    </div>
  )
}
