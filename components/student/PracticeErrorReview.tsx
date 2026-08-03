import { SECTION_LABELS, optionText, correctLetter, type AnswerLetter, type PracticeQuestion } from '@/lib/practice-data'

export interface WrongAnswer {
  question: PracticeQuestion
  selected: AnswerLetter | undefined
}

interface Props {
  wrongAnswers: WrongAnswer[]
  onBack: () => void
  practiceLink: string
}

export default function PracticeErrorReview({ wrongAnswers, onBack, practiceLink }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Разбор ошибок</h1>
        <button type="button" onClick={onBack} className="text-sm font-semibold text-gray-500 hover:text-gray-700">
          ← К результатам
        </button>
      </div>

      <div className="space-y-4">
        {wrongAnswers.map(({ question, selected }, i) => (
          <div key={question.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">
              {SECTION_LABELS[question.section] ?? question.section}
            </span>
            <p className="mt-3 text-sm font-bold leading-relaxed text-gray-900">
              {i + 1}. {question.question_text}
            </p>

            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-red-500">Твой ответ</p>
                <p className="text-sm text-red-700">
                  {selected ? optionText(question, selected) : 'Не отвечено'}
                </p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-green-600">Правильный ответ</p>
                <p className="text-sm text-green-800">
                  {optionText(question, correctLetter(question))}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <a
        href={practiceLink}
        className="block w-full rounded-xl bg-[#1B4FD8] py-3 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
      >
        Тренироваться по этим темам →
      </a>
    </div>
  )
}
