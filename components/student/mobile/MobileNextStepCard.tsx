'use client'

interface Props {
  questionCount: number
  /** True while the lesson has an unwatched video — the CTA renders disabled with a hint. */
  locked: boolean
  /** questionCount > 0 branch — starts the inline practice step. */
  onStartPractice: () => void
  /** questionCount === 0 branch — nothing to practice, just marks the lesson done. */
  onFinishNoQuestions: () => void
}

const MINUTES_PER_QUESTION = 1.5

// "Next step" card on the mobile lesson page's video step. Practice now
// happens inline on this same page (lessonStep: 'practice') rather than
// navigating to /student/online/practice — see MobileLessonPractice.
export default function MobileNextStepCard({ questionCount, locked, onStartPractice, onFinishNoQuestions }: Props) {
  const minutes = Math.ceil(questionCount * MINUTES_PER_QUESTION)

  if (locked) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-lg font-bold text-gray-400">✏️ Практика</p>
        <p className="mt-1 text-sm text-gray-400">{questionCount} вопросов • Сначала посмотри видео</p>
        <button
          type="button"
          disabled
          className="mt-4 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-gray-200 text-sm font-bold text-gray-400"
        >
          Начать практику
        </button>
      </div>
    )
  }

  if (questionCount === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-lg font-bold text-gray-900">✏️ Практика</p>
        <p className="mt-1 text-sm text-gray-400">Практика недоступна</p>
        <button
          type="button"
          onClick={onFinishNoQuestions}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#1B4FD8] text-sm font-bold text-white transition-colors active:bg-blue-700"
        >
          Завершить урок →
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-lg font-bold text-gray-900">✏️ Практика</p>
      <p className="mt-1 text-sm text-gray-500">{questionCount} вопросов • ~{minutes} мин</p>
      <button
        type="button"
        onClick={onStartPractice}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#1B4FD8] text-sm font-bold text-white transition-colors active:bg-blue-700"
      >
        Начать практику →
      </button>
    </div>
  )
}
