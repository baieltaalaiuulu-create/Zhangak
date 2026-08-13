'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Clock3, FileText, RefreshCw } from 'lucide-react'

import PracticeStartScreen from '@/components/student/PracticeStartScreen'
import PracticeQuestionScreen from '@/components/student/PracticeQuestionScreen'
import PracticeResultsScreen, { type WrongAnswer as ResultWrongAnswer } from '@/components/student/PracticeResultsScreen'
import PracticeErrorReview, { type WrongAnswer as ReviewWrongAnswer } from '@/components/student/PracticeErrorReview'
import { useStudentSession } from '@/components/student/StudentSessionContext'
import { ZhangakApiError, zhangakApiJson, zhangakApiRequest } from '@/lib/zhangak-api-client'
import {
  createPracticeIdempotencyKey,
  parseBeginPracticeAttempt,
  parsePlatformPracticeTests,
  parseSubmitPracticeAttempt,
  secondsUntil,
  type BeginPracticeAttemptResponse,
  type OpenPracticeQuestion,
  type PlatformPracticeAttempt,
  type PlatformPracticeTest,
  type PracticeAnswerLetter,
  type SubmitPracticeAttemptResponse,
} from '@/lib/platform-practice'

type View = 'catalog' | 'start' | 'question' | 'results' | 'review'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] font-sans">
      <div className="text-sm text-gray-500">Загрузка тренажёра…</div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-semibold text-gray-800">Не удалось открыть тренажёр</p>
      <p className="mt-2 text-sm leading-6 text-gray-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B4FD8] px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        <RefreshCw size={16} aria-hidden="true" />
        Повторить
      </button>
    </div>
  )
}

function subjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    math: 'Математика',
    kyr: 'Кыргыз тили',
    all: 'ОРТ',
  }
  return labels[subject] ?? 'Практика ОРТ'
}

function testTypeLabel(testType: PlatformPracticeTest['testType']): string {
  const labels: Record<PlatformPracticeTest['testType'], string> = {
    practice: 'Тренажёр',
    mock: 'Пробный тест',
    bank: 'Практика',
    diagnostic: 'Диагностика',
  }
  return labels[testType]
}

function Catalog({
  tests,
  onSelect,
  requestedType,
}: {
  tests: PlatformPracticeTest[]
  onSelect: (test: PlatformPracticeTest) => void
  requestedType: PlatformPracticeTest['testType'] | null
}) {
  const title = requestedType === 'mock' ? 'Пробный ОРТ' : 'Тренажёр'
  const description = requestedType === 'mock'
    ? 'Выбери опубликованный пробный тест. Проверка и результаты сохраняются на защищённом сервере Zhangak.'
    : 'Выбери опубликованный тест. Проверка и результаты сохраняются на защищённом сервере Zhangak.'
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#191B23]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>
        <Link href="/student/online" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#1B4FD8] hover:bg-blue-50">
          <ArrowLeft size={16} aria-hidden="true" />
          На главную
        </Link>
      </div>

      {tests.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-7 text-center shadow-sm">
          <FileText className="mx-auto text-gray-300" size={32} aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-gray-900">{requestedType === 'mock' ? 'Пробные ОРТ пока готовятся' : 'Тесты пока готовятся'}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Преподаватель ещё не опубликовал тест для твоей программы. Вернись позже или напиши преподавателю.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map(test => (
            <button
              key={test.id}
              type="button"
              onClick={() => onSelect(test)}
              className="group flex min-h-52 flex-col rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4FD8]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1B4FD8]">{subjectLabel(test.subject)}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{testTypeLabel(test.testType)}</span>
              </div>
              <h2 className="mt-4 text-base font-black leading-snug text-gray-900">{test.title}</h2>
              {test.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-500">{test.description}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-xs font-semibold text-gray-500">
                <span className="inline-flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />{test.questionCount} вопросов</span>
                {test.timeLimitSeconds && <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{Math.ceil(test.timeLimitSeconds / 60)} мин</span>}
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#1B4FD8]">
                Открыть <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZhangakApiError) {
    if (error.code === 'attempts_exhausted') return 'Все доступные попытки для этого теста уже использованы.'
    if (error.code === 'attempt_expired') return 'Время попытки истекло. Открой тест заново.'
    if (error.code === 'test_unavailable') return 'Этот тест больше не опубликован или недоступен для твоей группы.'
    return error.message
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export default function PracticePage() {
  // This verifies that the first-party session context is present. The
  // StudentLayout owns authentication; this page must never ask Supabase.
  useStudentSession()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [tests, setTests] = useState<PlatformPracticeTest[]>([])
  const [selectedTest, setSelectedTest] = useState<PlatformPracticeTest | null>(null)
  const [view, setView] = useState<View>('catalog')
  const [attempt, setAttempt] = useState<PlatformPracticeAttempt | null>(null)
  const [questions, setQuestions] = useState<OpenPracticeQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, PracticeAnswerLetter>>({})
  const [submission, setSubmission] = useState<SubmitPracticeAttemptResponse | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const requestedType = searchParams.get('type') === 'mock' ? 'mock' : null
  const visibleTests = useMemo(
    () => requestedType ? tests.filter(test => test.testType === requestedType) : tests,
    [requestedType, tests],
  )

  // Reuse idempotency keys after an ambiguous network failure. A new key is
  // created only when the learner deliberately starts a different attempt.
  const beginKeyRef = useRef<string | null>(null)
  const submitKeyRef = useRef<string | null>(null)
  const clientStartedAtRef = useRef<number | null>(null)
  const automaticSubmitRef = useRef(false)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setCatalogError(null)
    try {
      const response = await zhangakApiRequest<unknown>('/v1/platform/practice-tests')
      setTests(parsePlatformPracticeTests(response))
    } catch (error) {
      setCatalogError(errorMessage(error, 'Проверь подключение и попробуй ещё раз.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  const selectTest = useCallback((test: PlatformPracticeTest) => {
    setSelectedTest(test)
    setAttempt(null)
    setQuestions([])
    setAnswers({})
    setSubmission(null)
    setCurrentIndex(0)
    setSecondsLeft(null)
    setFlowError(null)
    beginKeyRef.current = null
    submitKeyRef.current = null
    clientStartedAtRef.current = null
    automaticSubmitRef.current = false
    setView('start')
  }, [])

  // Existing lesson cards link to `?lesson=<id>`. New lesson IDs are numeric;
  // if an old legacy link cannot be matched, the learner simply sees the safe
  // first-party catalog instead of an empty or broken test screen.
  useEffect(() => {
    const rawLessonId = searchParams.get('lesson')
    const lessonId = rawLessonId ? Number(rawLessonId) : Number.NaN
    if (loading || selectedTest || view !== 'catalog' || !Number.isSafeInteger(lessonId) || lessonId <= 0) return
    const test = tests.find(item => item.lessonId === lessonId)
    if (test) selectTest(test)
  }, [loading, searchParams, selectTest, selectedTest, tests, view])

  const startAttempt = useCallback(async () => {
    if (!selectedTest || starting) return
    setStarting(true)
    setFlowError(null)
    beginKeyRef.current ??= createPracticeIdempotencyKey()

    try {
      const response = await zhangakApiJson<unknown>('/v1/platform/practice-attempts', 'POST', {
        testId: selectedTest.id,
        idempotencyKey: beginKeyRef.current,
      })
      const data: BeginPracticeAttemptResponse = parseBeginPracticeAttempt(response)
      setAttempt(data.attempt)
      setQuestions(data.questions)
      setAnswers({})
      setCurrentIndex(0)
      setSecondsLeft(secondsUntil(data.attempt.expiresAt))
      clientStartedAtRef.current = Date.now()
      automaticSubmitRef.current = false
      setView('question')
    } catch (error) {
      setFlowError(errorMessage(error, 'Не удалось открыть попытку.'))
    } finally {
      setStarting(false)
    }
  }, [selectedTest, starting])

  const finishAttempt = useCallback(async () => {
    if (!attempt || submitting || submission) return
    setSubmitting(true)
    setFlowError(null)
    submitKeyRef.current ??= createPracticeIdempotencyKey()
    const elapsedSeconds = clientStartedAtRef.current === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - clientStartedAtRef.current) / 1000))

    try {
      const response = await zhangakApiJson<unknown>(`/v1/platform/practice-attempts/${encodeURIComponent(attempt.id)}/submit`, 'POST', {
        idempotencyKey: submitKeyRef.current,
        elapsedSeconds,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })),
      })
      const data = parseSubmitPracticeAttempt(response)
      setSubmission(data)
      setView('results')
    } catch (error) {
      const message = errorMessage(error, 'Не удалось отправить ответы.')
      setFlowError(message)
      if (error instanceof ZhangakApiError && error.code === 'attempt_expired') {
        setAttempt(null)
        setQuestions([])
        setAnswers({})
        setSecondsLeft(null)
        beginKeyRef.current = null
        submitKeyRef.current = null
        setView('start')
      }
    } finally {
      setSubmitting(false)
    }
  }, [answers, attempt, submission, submitting])

  useEffect(() => {
    if (view !== 'question' || secondsLeft === null) return
    if (secondsLeft <= 0) {
      if (!automaticSubmitRef.current) {
        automaticSubmitRef.current = true
        void finishAttempt()
      }
      return
    }
    const timer = window.setTimeout(() => setSecondsLeft(value => value === null ? value : Math.max(0, value - 1)), 1_000)
    return () => window.clearTimeout(timer)
  }, [finishAttempt, secondsLeft, view])

  const handleSelectAnswer = useCallback((answer: PracticeAnswerLetter) => {
    const question = questions[currentIndex]
    if (!question || submitting) return
    setAnswers(previous => ({ ...previous, [question.questionId]: answer }))
  }, [currentIndex, questions, submitting])

  const handleNext = useCallback(() => {
    if (currentIndex >= questions.length - 1) {
      void finishAttempt()
      return
    }
    setCurrentIndex(index => index + 1)
  }, [currentIndex, finishAttempt, questions.length])

  const handleRetry = useCallback(() => {
    if (!selectedTest) return
    setAttempt(null)
    setQuestions([])
    setAnswers({})
    setSubmission(null)
    setCurrentIndex(0)
    setSecondsLeft(null)
    setFlowError(null)
    beginKeyRef.current = null
    submitKeyRef.current = null
    clientStartedAtRef.current = null
    automaticSubmitRef.current = false
    setView('start')
  }, [selectedTest])

  const wrongAnswers = useMemo<ResultWrongAnswer[]>(() => {
    if (!submission) return []
    return submission.review.filter(question => !question.isCorrect).map(question => ({ question }))
  }, [submission])
  const reviewWrongAnswers = wrongAnswers as ReviewWrongAnswer[]
  const weakSection = useMemo(() => {
    const misses = new Map<string, number>()
    for (const { question } of wrongAnswers) misses.set(question.section, (misses.get(question.section) ?? 0) + 1)
    return [...misses.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
  }, [wrongAnswers])

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6">
      {catalogError ? <ErrorState message={catalogError} onRetry={() => void loadCatalog()} /> : (
        <>
          {view === 'catalog' && <Catalog tests={visibleTests} onSelect={selectTest} requestedType={requestedType} />}

          {view === 'start' && selectedTest && (
            <div className="space-y-4">
              <button type="button" onClick={() => setView('catalog')} className="mx-auto flex w-full max-w-2xl items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800">
                <ArrowLeft size={16} aria-hidden="true" />
                Ко всем тестам
              </button>
              {flowError && <ErrorState message={flowError} onRetry={() => void startAttempt()} />}
              <PracticeStartScreen test={selectedTest} questionCount={selectedTest.questionCount} onStart={() => void startAttempt()} starting={starting} />
            </div>
          )}

          {view === 'question' && attempt && questions.length > 0 && (
            <div className="space-y-4">
              {flowError && (
                <div role="alert" className="mx-auto max-w-5xl rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  {flowError} Нажми «Завершить» ещё раз: ответы останутся в этой вкладке.
                </div>
              )}
              <PracticeQuestionScreen
                questions={questions}
                currentIndex={currentIndex}
                answers={answers}
                secondsLeft={secondsLeft}
                onSelect={handleSelectAnswer}
                onNext={handleNext}
                onJump={setCurrentIndex}
                onFinish={() => void finishAttempt()}
                submitting={submitting}
              />
            </div>
          )}

          {view === 'results' && submission && (
            <PracticeResultsScreen
              score={submission.attempt.correctCount ?? 0}
              total={submission.attempt.questionCount}
              previousScore={null}
              passed={submission.attempt.passed ?? false}
              elapsedSeconds={submission.attempt.elapsedSeconds ?? 0}
              wrongAnswers={wrongAnswers}
              weakSection={weakSection}
              nextLessonTitle={null}
              nextLessonHref={null}
              onRetry={handleRetry}
              onReview={() => setView('review')}
            />
          )}

          {view === 'review' && submission && (
            <PracticeErrorReview
              wrongAnswers={reviewWrongAnswers}
              onBack={() => setView('results')}
              practiceLink="/student/online/practice"
            />
          )}
        </>
      )}
    </div>
  )
}
