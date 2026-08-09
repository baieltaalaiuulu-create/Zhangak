'use client'

import { useState } from 'react'
import { isCorrect, optionText, type AnswerLetter, type PracticeQuestion } from '@/lib/practice-data'

export interface LessonAnswerEntry {
  questionId: number
  answer: AnswerLetter
  correct: boolean
}

interface Props {
  questions: PracticeQuestion[]
  onBack: () => void
  onFinish: (answers: LessonAnswerEntry[]) => void
}

const LETTERS: AnswerLetter[] = ['a', 'b', 'c', 'd']
const FEEDBACK_MS = 1500

// Inline quiz step for the mobile lesson page — replaces the old "navigate
// to /student/online/practice" flow. Select an option (highlights blue),
// tap "Ответить" to lock it in (reveals correct/wrong for 1.5s), then
// auto-advances; the last question hands the full answer list up to the
// page, which saves it and moves to the 'complete' step.
export default function MobileLessonPractice({ questions, onBack, onFinish }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerLetter | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [answers, setAnswers] = useState<LessonAnswerEntry[]>([])

  const question = questions[currentQuestion]
  const total = questions.length
  const isLast = currentQuestion === total - 1
  const pct = total > 0 ? Math.round((currentQuestion / total) * 100) : 0
  const correctLetterForReveal = LETTERS.find(l => isCorrect(question, l))

  const handleSelect = (letter: AnswerLetter) => {
    if (showFeedback) return
    setSelectedAnswer(letter)
  }

  const handleSubmit = () => {
    if (!selectedAnswer || showFeedback) return
    const entry: LessonAnswerEntry = {
      questionId: question.id,
      answer: selectedAnswer,
      correct: isCorrect(question, selectedAnswer),
    }
    const nextAnswers = [...answers, entry]
    setAnswers(nextAnswers)
    setShowFeedback(true)

    window.setTimeout(() => {
      if (isLast) {
        onFinish(nextAnswers)
        return
      }
      setCurrentQuestion(i => i + 1)
      setSelectedAnswer(null)
      setShowFeedback(false)
    }, FEEDBACK_MS)
  }

  return (
    // z-[60] — above BottomNav (z-50, still mounted underneath by
    // StudentLayout since this route isn't in its full-screen-page list)
    // so the quiz genuinely covers the whole screen while active.
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#F4F6FA] md:hidden">
      <div className="border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="flex min-h-11 items-center text-sm font-bold text-gray-600">
            ← Назад
          </button>
          <p className="text-sm font-bold text-[#191B23]">Вопрос {currentQuestion + 1} из {total}</p>
          <div className="w-16" aria-hidden="true" />
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-[#1B4FD8]">Вопрос</p>
          <p className="mt-2 text-lg font-medium leading-relaxed text-[#191B23]">{question.question_text}</p>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {LETTERS.map(letter => {
            const isSelected = selectedAnswer === letter
            const isThisCorrect = showFeedback && letter === correctLetterForReveal
            const isThisWrong = showFeedback && isSelected && letter !== correctLetterForReveal

            const borderBg = isThisCorrect
              ? 'border-green-500 bg-green-50'
              : isThisWrong
                ? 'border-red-500 bg-red-50'
                : isSelected
                  ? 'border-[#1B4FD8] bg-blue-50'
                  : 'border-gray-200 bg-white'

            const circleBg = isThisCorrect
              ? 'bg-green-500 text-white'
              : isThisWrong
                ? 'bg-red-500 text-white'
                : isSelected
                  ? 'bg-[#1B4FD8] text-white'
                  : 'bg-gray-100 text-gray-500'

            return (
              <button
                key={letter}
                type="button"
                onClick={() => handleSelect(letter)}
                disabled={showFeedback}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${borderBg}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circleBg}`}>
                  {letter.toUpperCase()}
                </span>
                <span className="flex-1 text-sm text-gray-800">{optionText(question, letter)}</span>
                {isThisCorrect && <span className="shrink-0 text-xs font-bold text-green-600">✓ Верно!</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pb-4 pt-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedAnswer || showFeedback}
          className={`flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold transition-colors ${
            selectedAnswer && !showFeedback ? 'bg-[#1B4FD8] text-white active:bg-blue-700' : 'cursor-not-allowed bg-gray-200 text-gray-400'
          }`}
        >
          Ответить
        </button>
      </div>
    </div>
  )
}
