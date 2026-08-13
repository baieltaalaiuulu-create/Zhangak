import { Clock3 } from 'lucide-react'

import { PRACTICE_ANSWER_LETTERS, practiceOptionText, type OpenPracticeQuestion, type PracticeAnswerLetter } from '@/lib/platform-practice'

interface Props {
  questions: OpenPracticeQuestion[]
  currentIndex: number
  answers: Record<number, PracticeAnswerLetter>
  secondsLeft: number | null
  onSelect: (letter: PracticeAnswerLetter) => void
  onNext: () => void
  onJump: (index: number) => void
  onFinish: () => void
  submitting?: boolean
}

const LETTERS = PRACTICE_ANSWER_LETTERS

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PracticeQuestionScreen({
  questions, currentIndex, answers, secondsLeft, onSelect, onNext, onJump, onFinish, submitting = false,
}: Props) {
  const question = questions[currentIndex]
  const total = questions.length
  const answeredCount = Object.keys(answers).length
  const selected = answers[question.questionId]
  const isLast = currentIndex === total - 1

  return (
    <div className="mx-auto max-w-5xl">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex justify-between text-xs font-semibold text-gray-500">
            <span>Вопрос {currentIndex + 1} из {total}</span>
            <span>{answeredCount}/{total} отвечено</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#1B3F92] transition-all duration-500"
              style={{ width: `${(answeredCount / total) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {secondsLeft !== null && (
            <span className="whitespace-nowrap rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-600">
              <Clock3 className="mr-1 inline-block" size={15} aria-hidden="true" />
              {formatTime(secondsLeft)}
            </span>
          )}
          <button
            type="button"
            onClick={onFinish}
            disabled={submitting}
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            {submitting ? 'Отправляем…' : 'Завершить'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-start gap-5 lg:flex-row">
        {/* Question card */}
        <div className="w-full min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt="" className="mb-4 max-h-64 w-full rounded-xl object-contain" />
          )}
          <p className="text-base font-bold leading-relaxed text-gray-900">{question.questionText}</p>

          <div className="mt-5 flex flex-col gap-3">
            {LETTERS.map(letter => {
              const isSelected = selected === letter
              const text = practiceOptionText(question, letter)
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => onSelect(letter)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    isSelected ? 'border-[#1B3F92] bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isSelected ? 'bg-[#1B3F92] text-white' : 'bg-white text-gray-500'
                  }`}>
                    {letter.toUpperCase()}
                  </span>
                  <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{text}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 space-y-5 lg:w-72">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Навигация</h3>
            <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
              {questions.map((q, i) => {
                const isAnswered = answers[q.questionId] !== undefined
                const isCurrent = i === currentIndex
                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => onJump(i)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCurrent ? 'bg-[#1B3F92] text-white' :
                      isAnswered ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Отвечено {answeredCount} из {total}
            </p>
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!selected || submitting}
            className="block w-full rounded-xl bg-[#1B3F92] py-3 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            {submitting ? 'Отправляем…' : isLast ? 'Завершить тест' : 'Следующий вопрос →'}
          </button>
        </div>
      </div>
    </div>
  )
}
