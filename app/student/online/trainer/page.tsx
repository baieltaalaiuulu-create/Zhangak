'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, RefreshCw, RotateCcw, XCircle } from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import { answerTrainerQuestion, getTrainerHistory, getTrainerQuestion, resetTrainer, type AnswerLetter, type TrainerHistoryItem, type TrainerQuestion } from '@/lib/platform-gamification'

export default function TrainerPage() {
  useStudentSession()
  const [subject, setSubject] = useState<'math' | 'kyr'>('math')
  const [section, setSection] = useState('general')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [question, setQuestion] = useState<TrainerQuestion | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<TrainerHistoryItem[] | null>(null)

  const next = async () => {
    setLoading(true); setError(null); setResult(null)
    try { setQuestion(await getTrainerQuestion({ subject, section, difficulty })) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось получить вопрос') } finally { setLoading(false) }
  }
  const answer = async (value: AnswerLetter) => {
    if (!question || result !== null || loading) return
    setLoading(true); setError(null)
    try { setResult(await answerTrainerQuestion(question.issueId, value)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось проверить ответ') } finally { setLoading(false) }
  }
  const reset = async () => {
    if (!confirm('Сбросить только список правильно решённых вопросов? Полученный XP не изменится.')) return
    setLoading(true); setError(null)
    try { await resetTrainer(); setQuestion(null); setResult(null); setHistory(null) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сбросить прогресс') } finally { setLoading(false) }
  }
  const showHistory = async () => {
    setLoading(true); setError(null)
    try { setHistory(await getTrainerHistory()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось получить историю') } finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-[#F4F6FA] px-4 py-5"><div className="mx-auto max-w-2xl"><Link href="/student/online" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-gray-500"><ArrowLeft size={16} />На главную</Link><section className="mt-3 rounded-2xl bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#1B3F92]">ТРЕНАЖЁР</p><h1 className="mt-1 text-xl font-black">Практика без повторов</h1><p className="mt-2 text-sm text-gray-500">Правильно решённый вопрос больше не появится. Сброс не отнимает XP.</p></div><div className="flex gap-2"><button onClick={() => void showHistory()} disabled={loading} className="inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-bold text-gray-600">История</button><button onClick={() => void reset()} disabled={loading} className="inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-bold text-gray-600"><RotateCcw size={15} />Сбросить</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-gray-600">Предмет<select value={subject} onChange={event => setSubject(event.target.value as typeof subject)} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm"><option value="math">Математика</option><option value="kyr">Кыргыз тили</option></select></label><label className="text-xs font-bold text-gray-600">Раздел<input value={section} onChange={event => setSection(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 text-sm" /></label><label className="text-xs font-bold text-gray-600">Сложность<select value={difficulty} onChange={event => setDifficulty(event.target.value as typeof difficulty)} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm"><option value="easy">Легко</option><option value="medium">Средне</option><option value="hard">Сложно</option></select></label></div>{!question ? <button onClick={() => void next()} disabled={loading} className="mt-5 min-h-11 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white disabled:opacity-60">{loading ? 'Ищем…' : 'Начать'}</button> : <div className="mt-6"><p className="text-lg font-black leading-relaxed text-[#191B23]">{question.questionText}</p><div className="mt-5 space-y-3">{(['a', 'b', 'c', 'd'] as AnswerLetter[]).map(letter => <button key={letter} onClick={() => void answer(letter)} disabled={loading || result !== null} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-gray-200 px-4 text-left text-sm font-semibold hover:border-blue-200 disabled:opacity-60"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs uppercase">{letter}</span>{question.options[letter]}</button>)}</div>{result !== null && <div className={`mt-5 flex items-center gap-2 rounded-xl p-3 text-sm font-bold ${result ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{result ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{result ? 'Верно — этот вопрос больше не появится.' : 'Пока неверно — вопрос может встретиться снова.'}</div>}<button onClick={() => void next()} disabled={loading || result === null} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={16} />Следующий вопрос</button></div>}{history && <section className="mt-8 border-t pt-5"><h2 className="text-base font-black">Последние ответы</h2>{history.length === 0 ? <p className="mt-2 text-sm text-gray-500">Пока нет решённых вопросов.</p> : <div className="mt-3 space-y-3">{history.map(item => <article key={`${item.questionId}-${item.answeredAt}`} className={`rounded-xl border p-3 ${item.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><p className="text-sm font-bold">{item.questionText}</p><p className="mt-1 text-xs text-gray-600">Твой: {item.selectedAnswer.toUpperCase()} · Правильный: {item.correctAnswer.toUpperCase()}</p>{item.explanation && <p className="mt-1 text-xs text-gray-600">{item.explanation}</p>}</article>)}</div>}</section>}{error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}</section></div></main>
}
