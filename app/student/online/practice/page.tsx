'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchPracticeTest,
  fetchQuestions,
  fetchPreviousScore,
  fetchPracticeTopics,
  fetchQuestionsBySection,
  subjectForSection,
  savePracticeResult,
  isCorrect,
  PASS_RATIO,
  type PracticeTest,
  type PracticeQuestion,
  type AnswerLetter,
  type PracticeTopic,
} from '@/lib/practice-data'
import { fetchLessons, type Lesson } from '@/lib/lessons-data'
import { calcStreak } from '@/lib/student-data'
import PracticeStartScreen from '@/components/student/PracticeStartScreen'
import PracticeQuestionScreen from '@/components/student/PracticeQuestionScreen'
import PracticeResultsScreen, { type WrongAnswer } from '@/components/student/PracticeResultsScreen'
import PracticeErrorReview from '@/components/student/PracticeErrorReview'
import PracticeTopicBrowser from '@/components/student/practice/PracticeTopicBrowser'

type View = 'start' | 'question' | 'results' | 'review'

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )
}

function EmptyState({ text, backHref = '/student/online/practice', backLabel = '← Назад к практике' }: { text: string; backHref?: string; backLabel?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] p-6 text-center">
      <p className="text-sm font-semibold text-gray-600">{text}</p>
      <Link href={backHref} className="text-sm font-bold text-[#1B4FD8]">
        {backLabel}
      </Link>
    </div>
  )
}

export default function PracticePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lessonId = searchParams.get('lesson')
  const sectionParam = searchParams.get('section')
  const topicParam = searchParams.get('topic')
  const bankMode = !lessonId && !!sectionParam && !!topicParam

  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [test, setTest] = useState<PracticeTest | null>(null)
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [streak, setStreak] = useState(0)
  const [topics, setTopics] = useState<PracticeTopic[]>([])

  const [view, setView] = useState<View>('start')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerLetter>>({})
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setStudentId(user.id)

      if (lessonId) {
        const foundTest = await fetchPracticeTest(lessonId)
        setTest(foundTest)

        if (foundTest) {
          const [qs, prevScore, allLessons] = await Promise.all([
            fetchQuestions(foundTest.id),
            fetchPreviousScore(user.id, foundTest.id),
            fetchLessons(),
          ])
          setQuestions(qs)
          setPreviousScore(prevScore)
          setLessons(allLessons)
        }
      } else if (sectionParam && topicParam) {
        const qs = await fetchQuestionsBySection(sectionParam)
        if (qs.length > 0) {
          // id is a placeholder — section practice has no practice_tests row,
          // so finishTest() below sends null for test_id instead of this.
          setTest({ id: 0, title: topicParam, subject: subjectForSection(sectionParam), time_limit_minutes: null, lesson_id: null })
          setQuestions(qs)
        }
        // No cross-topic "previous score" comparison — a section pool is
        // shared across every topic under it, so a raw score comparison
        // against the last attempt (possibly a different topic, different
        // question count, different random subset) would be misleading
        // rather than useful.
      } else {
        setTopics(await fetchPracticeTopics())
        setLoading(false)
        return
      }

      const { data: allResults } = await supabase
        .from('practice_results')
        .select('completed_at')
        .eq('student_id', user.id)
        .not('completed_at', 'is', null)
      setStreak(calcStreak((allResults ?? []).map(r => r.completed_at as string)))

      setLoading(false)
    }
    load()
  }, [router, lessonId, sectionParam, topicParam])

  const finishTest = async () => {
    if (!test || !studentId) { setView('results'); return }

    if (startedAt) {
      setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000))
    }

    const correctCount = questions.filter(q => {
      const a = answers[q.id]
      return a ? isCorrect(q, a) : false
    }).length

    if (!saved) {
      setSaved(true)
      await savePracticeResult({
        studentId,
        testId: bankMode ? null : test.id,
        lessonId: test.lesson_id,
        score: correctCount,
        answers,
      })
    }

    setView('results')
  }

  // Countdown timer
  useEffect(() => {
    if (view !== 'question' || secondsLeft === null) return
    if (secondsLeft <= 0) {
      const timer = window.setTimeout(() => finishTest(), 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => setSecondsLeft(prev => (prev !== null ? prev - 1 : prev)), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, secondsLeft])

  if (loading) return <LoadingScreen />

  if (!lessonId && !bankMode) {
    return <PracticeTopicBrowser topics={topics} />
  }

  if (!test) {
    return lessonId
      ? <EmptyState text="Тест для этого урока пока недоступен" backHref="/student/online/lessons" backLabel="← Ко всем урокам" />
      : <EmptyState text="Вопросы для этой темы ещё не добавлены" />
  }
  if (questions.length === 0) {
    return lessonId
      ? <EmptyState text="В этом тесте пока нет вопросов" backHref="/student/online/lessons" backLabel="← Ко всем урокам" />
      : <EmptyState text="Вопросы для этой темы ещё не добавлены" />
  }

  const handleStart = () => {
    setStartedAt(Date.now())
    if (test.time_limit_minutes) setSecondsLeft(test.time_limit_minutes * 60)
    setView('question')
  }

  const handleSelect = (letter: AnswerLetter) => {
    const question = questions[currentIndex]
    setAnswers(prev => ({ ...prev, [question.id]: letter }))
  }

  const handleNext = () => {
    if (currentIndex === questions.length - 1) {
      finishTest()
      return
    }
    setCurrentIndex(i => i + 1)
  }

  const handleRetry = () => {
    setAnswers({})
    setCurrentIndex(0)
    setSecondsLeft(null)
    setStartedAt(null)
    setElapsedSeconds(0)
    setSaved(false)
    setView('start')
  }

  const wrongAnswers: WrongAnswer[] = questions
    .filter(q => {
      const a = answers[q.id]
      return !a || !isCorrect(q, a)
    })
    .map(q => ({ question: q, selected: answers[q.id] }))

  const score = questions.length - wrongAnswers.length
  const passingScore = Math.ceil(questions.length * PASS_RATIO)
  const passed = score >= passingScore

  const sectionMisses: Record<string, number> = {}
  wrongAnswers.forEach(({ question }) => {
    sectionMisses[question.section] = (sectionMisses[question.section] ?? 0) + 1
  })
  const weakSection = Object.keys(sectionMisses).sort((a, b) => sectionMisses[b] - sectionMisses[a])[0] ?? null
  const projectedScore = Math.min(questions.length, score + Math.ceil(wrongAnswers.length * 0.5))

  const currentLessonIndex = lessons.findIndex(l => l.id === test.lesson_id)
  const nextLesson = currentLessonIndex >= 0 ? lessons[currentLessonIndex + 1] ?? null : null

  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6">
      {view === 'start' && (
        <PracticeStartScreen test={test} questionCount={questions.length} onStart={handleStart} />
      )}

      {view === 'question' && (
        <PracticeQuestionScreen
          questions={questions}
          currentIndex={currentIndex}
          answers={answers}
          secondsLeft={secondsLeft}
          onSelect={handleSelect}
          onNext={handleNext}
          onJump={setCurrentIndex}
          onFinish={finishTest}
        />
      )}

      {view === 'results' && (
        <PracticeResultsScreen
          score={score}
          total={questions.length}
          previousScore={previousScore}
          passed={passed}
          elapsedSeconds={elapsedSeconds}
          streak={streak}
          wrongAnswers={wrongAnswers}
          weakSection={weakSection}
          projectedScore={projectedScore}
          nextLessonTitle={nextLesson?.title ?? null}
          nextLessonHref={nextLesson ? `/student/online/lessons/${nextLesson.id}` : null}
          onRetry={handleRetry}
          onReview={() => setView('review')}
        />
      )}

      {view === 'review' && (
        <PracticeErrorReview
          wrongAnswers={wrongAnswers}
          onBack={() => setView('results')}
          practiceLink="/student/online/practice"
        />
      )}
    </div>
  )
}
