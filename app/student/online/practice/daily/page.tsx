'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Star } from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import { getDailyChallenge, startDailyChallenge, submitDailyChallenge, type AnswerLetter, type DailyAttempt } from '@/lib/platform-gamification'

export default function DailyChallengeFlowPage() {
  useStudentSession()
  const [attempt, setAttempt] = useState<DailyAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerLetter>>({})
  const [busy, setBusy] = useState(false)
  const beginKey = useRef<string | undefined>(undefined)
  const submitKey = useRef<string | undefined>(undefined)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const daily = await getDailyChallenge()
      if (daily.attempt) setAttempt(daily.attempt)
      else if (!daily.available) setAttempt(null)
      else {
        beginKey.current ??= crypto.randomUUID()
        setAttempt(await startDailyChallenge(beginKey.current))
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось открыть задание дня') } finally { setLoading(false) }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const submit = async () => {
    if (!attempt?.questions || busy) return
    setBusy(true); setError(null)
    try {
      submitKey.current ??= crypto.randomUUID()
      setAttempt(await submitDailyChallenge(submitKey.current, Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer }))))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отправить ответы') } finally { setBusy(false) }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F4F6FA] text-sm font-semibold text-gray-500"><LoaderCircle size={18} className="mr-2 animate-spin" />Загружаем задание дня…</main>
  if (error) return <main className="mx-auto max-w-lg px-4 py-12 text-center"><p className="text-sm font-semibold text-red-700">{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl bg-[#1B3F92] px-4 py-2.5 text-sm font-bold text-white">Повторить</button></main>
  if (!attempt) return <main className="mx-auto max-w-lg px-4 py-12 text-center"><h1 className="text-xl font-black">Задание дня готовится</h1><p className="mt-2 text-sm text-gray-500">Оно появляется раз в сутки после 00:00 по Бишкеку.</p><Link href="/student/online/practice" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white">Открыть тренажёр</Link></main>
  if (attempt.status === 'submitted') return <main className="mx-auto max-w-2xl px-4 py-12 text-center"><CheckCircle2 size={42} className="mx-auto text-emerald-600" /><h1 className="mt-3 text-xl font-black">Задание дня выполнено</h1><div className="mt-5 flex justify-center gap-1">{[1, 2, 3].map(star => <Star key={star} size={30} className={star <= (attempt.starCount ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />)}</div><p className="mt-4 text-sm font-semibold text-gray-700">{attempt.correctCount}/15 · {attempt.scorePercent}% · +{attempt.xpAwarded} XP</p><p className="mt-2 text-xs text-gray-500">Новая попытка будет завтра после 00:00 по Бишкеку.</p>{attempt.review && <section className="mt-8 text-left"><h2 className="text-base font-black">Разбор ответов</h2><div className="mt-3 space-y-3">{attempt.review.map((item, reviewIndex) => <article key={item.id} className={`rounded-xl border p-4 ${item.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><p className="text-xs font-bold text-gray-500">ВОПРОС {reviewIndex + 1}</p><p className="mt-1 text-sm font-bold text-gray-900">{item.questionText}</p><p className="mt-2 text-xs text-gray-700">Твой ответ: <b>{item.selectedAnswer?.toUpperCase() ?? 'нет ответа'}</b> · Правильный: <b>{item.correctAnswer.toUpperCase()}</b></p>{item.explanation && <p className="mt-2 text-xs text-gray-600">{item.explanation}</p>}</article>)}</div></section>}<Link href="/student/online" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white">На главную</Link></main>
  const question = attempt.questions?.[index]
  if (!question) return null
  const last = index === 14
  return <main className="min-h-screen bg-[#F4F6FA] px-4 py-5"><div className="mx-auto max-w-2xl"><Link href="/student/online" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-gray-500"><ArrowLeft size={16} />На главную</Link><section className="mt-3 rounded-2xl bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold text-[#1B3F92]">ЗАДАНИЕ ДНЯ · {index + 1} ИЗ 15</p><h1 className="mt-4 text-lg font-black leading-relaxed text-[#191B23]">{question.questionText}</h1><div className="mt-6 space-y-3">{(['a', 'b', 'c', 'd'] as AnswerLetter[]).map(letter => <button key={letter} onClick={() => setAnswers(current => ({ ...current, [question.id]: letter }))} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold ${answers[question.id] === letter ? 'border-[#1B3F92] bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs uppercase">{letter}</span>{question.options[letter]}</button>)}</div><div className="mt-7 flex justify-between gap-3"><button disabled={index === 0 || busy} onClick={() => setIndex(current => current - 1)} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-40">Назад</button>{last ? <button disabled={busy} onClick={() => void submit()} className="min-h-11 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Отправляем…' : 'Завершить'}</button> : <button onClick={() => setIndex(current => current + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white">Далее<ArrowRight size={16} /></button>}</div></section></div></main>
}
