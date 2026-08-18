'use client'

import { useState } from 'react'

import StudentVisualIcon from '@/components/student/StudentVisualIcon'
import { useStudentSession } from '@/components/student/StudentSessionContext'
import { answerTrainerQuestion, getTrainerHistory, getTrainerQuestion, resetTrainer, type AnswerLetter, type TrainerHistoryItem, type TrainerQuestion } from '@/lib/platform-gamification'

const SUBJECTS = [
  { key: 'kyr', label: 'Кыргыз тили', icon: 'translate' },
  { key: 'math', label: 'Математика', icon: 'calculate' },
] as const
const DIFFICULTIES = [
  { key: 'easy', label: 'Лёгкая' },
  { key: 'medium', label: 'Средняя' },
  { key: 'hard', label: 'Сложная' },
] as const

export default function TrainerPage() {
  useStudentSession()
  const [subject, setSubject] = useState<'math' | 'kyr'>('kyr')
  const [section, setSection] = useState('analogies')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [question, setQuestion] = useState<TrainerQuestion | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<TrainerHistoryItem[] | null>(null)

  const chooseSubject = (nextSubject: 'math' | 'kyr') => {
    setSubject(nextSubject)
    setSection(nextSubject === 'kyr' ? 'analogies' : 'general')
    setQuestion(null)
    setResult(null)
  }

  const next = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const found = await getTrainerQuestion({ subject, section, difficulty })
      setQuestion(found)
      if (!found) setError('В этом разделе пока не осталось доступных вопросов. Выбери другой раздел или сложность.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось получить вопрос')
    } finally { setLoading(false) }
  }
  const answer = async (value: AnswerLetter) => {
    if (!question || result !== null || loading) return
    setLoading(true); setError(null)
    try { setResult(await answerTrainerQuestion(question.issueId, value)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось проверить ответ') }
    finally { setLoading(false) }
  }
  const reset = async () => {
    if (!confirm('Сбросить список правильно решённых вопросов? Полученный XP сохранится.')) return
    setLoading(true); setError(null)
    try { await resetTrainer(); setQuestion(null); setResult(null); setHistory(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сбросить прогресс') }
    finally { setLoading(false) }
  }
  const showHistory = async () => {
    setLoading(true); setError(null)
    try { setHistory(await getTrainerHistory()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось получить историю') }
    finally { setLoading(false) }
  }

  const sectionOptions = subject === 'kyr'
    ? [{ value: 'analogies', label: 'Аналогии' }, { value: 'grammar', label: 'Грамматика' }]
    : [{ value: 'general', label: 'Общая математика' }]

  return (
    <main className="px-4 pb-28 pt-5 sm:mx-auto sm:max-w-2xl sm:pb-10">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Тренажёр</h1>
        <p className="mt-1 text-[13px] leading-5 text-[var(--student-ink-2)]">Выбирай тему и сложность. Правильно решённый вопрос больше не повторится.</p>
      </header>

      <section className="mt-4 overflow-hidden rounded-[22px] border border-[var(--student-line)] bg-white">
        <div className="flex items-center gap-3 bg-[var(--student-brand-50)] px-4 py-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--student-brand)]"><StudentVisualIcon name="fitness_center" size={27} /></span>
          <div className="min-w-0"><h2 className="text-[17px] font-extrabold">Практика без повторов</h2><p className="text-xs text-[var(--student-ink-2)]">Вопросы из проверенного банка</p></div>
        </div>

        <div className="space-y-4 p-4">
          {!question && <>
            <fieldset>
              <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--student-ink-3)]">Предмет</legend>
              <div className="flex gap-2">{SUBJECTS.map(item => { const active = subject === item.key; return <button key={item.key} type="button" onClick={() => chooseSubject(item.key)} className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-[13px] font-bold ${active ? 'border-[var(--student-brand)] bg-[var(--student-brand)] text-white' : 'border-[var(--student-line)] bg-white text-[var(--student-ink-2)]'}`}><StudentVisualIcon name={item.icon} size={18} color={active ? '#fff' : 'var(--student-brand)'} />{item.label}</button> })}</div>
            </fieldset>
            <label className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--student-ink-3)]">Раздел
              <select value={section} onChange={event => setSection(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--student-line)] bg-white px-4 text-sm font-semibold normal-case tracking-normal text-[var(--student-ink)] outline-none focus:border-[var(--student-brand)]">{sectionOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </label>
            <fieldset>
              <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--student-ink-3)]">Сложность</legend>
              <div className="flex gap-2">{DIFFICULTIES.map(item => { const active = difficulty === item.key; return <button key={item.key} type="button" onClick={() => setDifficulty(item.key)} className={`min-h-10 min-w-0 flex-1 rounded-[14px] border px-2 text-xs font-bold ${active ? 'border-[var(--student-brand)] bg-[var(--student-brand)] text-white' : 'border-[var(--student-line)] text-[var(--student-ink-2)]'}`}>{item.label}</button> })}</div>
            </fieldset>
            <button type="button" onClick={() => void next()} disabled={loading} className="flex min-h-14 w-full items-center justify-center rounded-2xl border-b-4 border-[var(--student-brand-dark)] bg-[var(--student-brand)] px-4 text-base font-extrabold text-white active:translate-y-0.5 disabled:opacity-60">{loading ? 'Ищем вопрос…' : 'Начать тренировку'}</button>
          </>}

          {question && <div>
            <div className="mb-4 flex items-center justify-between gap-2 text-xs font-bold text-[var(--student-ink-3)]"><span>{question.section} · {question.difficulty}</span><button type="button" onClick={() => { setQuestion(null); setResult(null) }} className="rounded-full bg-[var(--student-surface-2)] px-3 py-2 text-[var(--student-brand)]">Изменить тему</button></div>
            <h2 className="text-lg font-black leading-7">{question.questionText}</h2>
            <div className="mt-4 space-y-2.5">{(['a', 'b', 'c', 'd'] as AnswerLetter[]).map(letter => <button key={letter} type="button" onClick={() => void answer(letter)} disabled={loading || result !== null} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-[var(--student-line)] bg-white px-3.5 text-left text-sm font-semibold transition-colors hover:border-[var(--student-brand)] disabled:opacity-70"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--student-surface-2)] font-extrabold uppercase text-[var(--student-brand)]">{letter}</span>{question.options[letter]}</button>)}</div>
            {result !== null && <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 text-sm font-bold ${result ? 'bg-[var(--student-success-50)] text-[var(--student-success)]' : 'bg-red-50 text-red-700'}`}><StudentVisualIcon name={result ? 'task_alt' : 'cancel'} size={22} color="currentColor" />{result ? 'Верно! Этот вопрос больше не появится.' : 'Пока неверно. Вопрос останется в тренировке.'}</div>}
            <button type="button" onClick={() => void next()} disabled={loading || result === null} className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--student-brand)] px-4 text-sm font-extrabold text-white disabled:opacity-45"><StudentVisualIcon name="arrow_forward" size={20} color="#fff" />Следующий вопрос</button>
          </div>}
          {error && <p role="alert" className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold leading-5 text-amber-800">{error}</p>}
        </div>
      </section>

      <div className="mt-3 flex gap-2"><button type="button" onClick={() => void showHistory()} disabled={loading} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--student-line)] bg-white text-sm font-bold text-[var(--student-brand)]"><StudentVisualIcon name="history" size={19} />История</button><button type="button" onClick={() => void reset()} disabled={loading} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--student-line)] bg-white text-sm font-bold text-[var(--student-ink-2)]"><StudentVisualIcon name="restart_alt" size={19} />Сбросить</button></div>

      {history && <section className="mt-4 rounded-[22px] border border-[var(--student-line)] bg-white p-4"><h2 className="text-base font-black">Последние ответы</h2>{history.length === 0 ? <p className="mt-2 text-sm text-[var(--student-ink-2)]">Пока нет решённых вопросов.</p> : <div className="mt-3 space-y-2">{history.map(item => <article key={`${item.questionId}-${item.answeredAt}`} className={`rounded-2xl border p-3 ${item.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><p className="text-sm font-bold">{item.questionText}</p><p className="mt-1 text-xs text-[var(--student-ink-2)]">Твой: {item.selectedAnswer.toUpperCase()} · Правильный: {item.correctAnswer.toUpperCase()}</p>{item.explanation && <p className="mt-1 text-xs text-[var(--student-ink-2)]">{item.explanation}</p>}</article>)}</div>}</section>}
    </main>
  )
}
