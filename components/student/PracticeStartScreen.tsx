import type { PlatformPracticeTest } from '@/lib/platform-practice'

interface Props {
  test: PlatformPracticeTest
  questionCount: number
  onStart: () => void
  starting?: boolean
}

const SUBJECT_META: Record<string, { label: string; color: string; bg: string }> = {
  math: { label: 'Математика', color: 'text-blue-600', bg: 'bg-blue-50' },
  kyr: { label: 'Кыргыз тили', color: 'text-orange-600', bg: 'bg-orange-50' },
  all: { label: 'Общий тест', color: 'text-purple-600', bg: 'bg-purple-50' },
}

const DEFAULT_SUBJECT_META = { label: 'Практика ОРТ', color: 'text-purple-600', bg: 'bg-purple-50' }

const RULES = [
  'На каждый вопрос только один правильный ответ',
  'Можно переходить между вопросами и менять ответ',
  'Правильные ответы покажутся только после завершения теста',
  'Результат автоматически сохранится в твой прогресс',
]

export default function PracticeStartScreen({ test, questionCount, onStart, starting = false }: Props) {
  const meta = SUBJECT_META[test.subject] ?? DEFAULT_SUBJECT_META
  const passingScore = Math.ceil(questionCount * (test.passScoreRatio ?? 0.7))
  const timeLabel = test.timeLimitSeconds ? `${Math.ceil(test.timeLimitSeconds / 60)} мин` : 'Без лимита'

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
        <h1 className="mt-3 text-2xl font-bold leading-snug text-gray-900">{test.title}</h1>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <div className="text-xl font-bold text-gray-900">{questionCount}</div>
            <div className="mt-0.5 text-xs text-gray-500">вопросов</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <div className="text-xl font-bold text-gray-900">
              {timeLabel}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">на тест</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <div className="text-xl font-bold text-gray-900">{passingScore}/{questionCount}</div>
            <div className="mt-0.5 text-xs text-gray-500">для зачёта</div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-gray-900">Правила</h2>
          <ul className="mt-2 space-y-2">
            {RULES.map(rule => (
              <li key={rule} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-0.5 text-[#1B4FD8]">•</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="mt-8 w-full rounded-xl bg-[#1B4FD8] py-3.5 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {starting ? 'Открываем тест…' : 'Начать тест'}
        </button>
      </div>
    </div>
  )
}
