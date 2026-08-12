'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, Plus, RefreshCw, Trash2, Loader2, X } from 'lucide-react'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import { SUBJECT_TAB_SECTIONS } from '@/lib/practice-data'
import {
  fetchChallengeById, fetchChallengeQuestions, SUBJECT_META, optionText,
  type DailyChallenge, type DailyChallengeQuestion, type ChallengeSubject, type AnswerLetter,
} from '@/lib/daily-challenge-data'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

const SUBJECTS: ChallengeSubject[] = ['math', 'kyr', 'analogy', 'reading']
const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']
const DIFFICULTIES: DailyChallengeQuestion['difficulty'][] = ['easy', 'medium', 'hard']
const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' }

function blankQuestion(challengeId: string, orderNum: number): Omit<DailyChallengeQuestion, 'id'> {
  return {
    challenge_id: challengeId,
    question_text: '',
    subject: 'math',
    section: SUBJECT_TAB_SECTIONS.math[0],
    topic: '',
    difficulty: 'medium',
    option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'A',
    order_num: orderNum,
    ai_generated: false,
  }
}

export default function DailyChallengeEditorPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const challengeId = params.id

  const [loading, setLoading] = useState(true)
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [questions, setQuestions] = useState<DailyChallengeQuestion[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DailyChallengeQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [preview, setPreview] = useState(searchParams.get('preview') === '1')

  const load = async () => {
    const [c, qs] = await Promise.all([fetchChallengeById(challengeId), fetchChallengeQuestions(challengeId)])
    setChallenge(c)
    setQuestions(qs)
    setActiveId(prev => prev && qs.some(q => q.id === prev) ? prev : qs[0]?.id ?? null)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const [c, qs] = await Promise.all([fetchChallengeById(challengeId), fetchChallengeQuestions(challengeId)])
      setChallenge(c)
      setQuestions(qs)
      setActiveId(qs[0]?.id ?? null)
      setLoading(false)
    }
    init()
  }, [challengeId])

  const active = questions.find(q => q.id === activeId) ?? null

  const patchQuestion = async (id: string, payload: Partial<DailyChallengeQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...payload } : q))
    await authenticatedFetch('/api/admin/daily-challenge/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, payload }),
    })
  }

  const handleAdd = async () => {
    const nextOrder = (questions[questions.length - 1]?.order_num ?? 0) + 1
    const res = await authenticatedFetch('/api/admin/daily-challenge/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, payload: blankQuestion(challengeId, nextOrder), orderNum: nextOrder }),
    })
    const data = await res.json()
    if (res.ok && data.id) {
      await load()
      setActiveId(data.id)
    }
  }

  const handleReplaceWithAI = async () => {
    if (!active) return
    setReplacing(true)
    try {
      const res = await authenticatedFetch('/api/admin/daily-challenge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaceQuestionId: active.id }),
      })
      if (res.ok) await load()
    } finally {
      setReplacing(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await authenticatedFetch('/api/admin/daily-challenge/questions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      setDeleteTarget(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  const saveDraft = async () => {
    if (!challenge) return
    setSaving(true)
    await authenticatedFetch('/api/admin/daily-challenge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: challenge.id, status: challenge.status === 'published' ? 'published' : 'draft' }),
    })
    setSaving(false)
  }

  const publish = async () => {
    if (!challenge) return
    setPublishing(true)
    await authenticatedFetch('/api/admin/daily-challenge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: challenge.id, status: 'published' }),
    })
    setPublishing(false)
    await load()
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF] text-sm text-gray-400">Загрузка...</div>
  }

  if (!challenge) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAF8FF]">
        <p className="text-sm font-semibold text-gray-600">Задание не найдено</p>
        <Link href="/admin/daily-challenge" className="text-sm font-bold text-[#1B4FD8]">← Daily Challenge</Link>
      </div>
    )
  }

  const dateLabel = new Date(`${challenge.date}T00:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <Link href="/admin/daily-challenge" className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Daily Challenge
        </Link>
        <h1 className="text-sm font-bold text-[#191B23]">Задание на {dateLabel}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPreview(true)} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <Eye size={15} /> Preview ученика
          </button>
          <button type="button" onClick={saveDraft} disabled={saving} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
            {saving ? 'Сохранение...' : 'Сохранить черновик'}
          </button>
          <button type="button" onClick={publish} disabled={publishing || challenge.status === 'published'} className="rounded-xl bg-[#1B4FD8] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {challenge.status === 'published' ? 'Опубликовано' : publishing ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Left panel */}
        <aside className="w-[220px] shrink-0 border-r border-gray-100 bg-white p-3" style={{ minHeight: 'calc(100vh - 61px)' }}>
          <div className="space-y-1">
            {questions.map((q, i) => {
              const meta = SUBJECT_META[q.subject]
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveId(q.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                    activeId === q.id ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="w-4 shrink-0 font-bold">{i + 1}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                  <span className="min-w-0 flex-1 truncate">{q.question_text || 'Новый вопрос'}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-2.5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50"
          >
            <Plus size={14} /> Добавить
          </button>
        </aside>

        {/* Right panel */}
        <main className="min-w-0 flex-1 p-5 sm:p-7">
          {!active ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
              Нет вопросов — нажмите «Добавить» слева
            </div>
          ) : (
            <div className="max-w-2xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-[#191B23]">
                  Редактирование вопроса #{questions.findIndex(q => q.id === active.id) + 1}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReplaceWithAI}
                    disabled={replacing}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {replacing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Заменить через AI
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(active)}
                    className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-100"
                  >
                    <Trash2 size={14} /> Удалить
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">Текст вопроса</label>
                <textarea
                  defaultValue={active.question_text}
                  key={`text-${active.id}`}
                  onBlur={e => patchQuestion(active.id, { question_text: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">Предмет</label>
                  <select
                    value={active.subject}
                    onChange={e => patchQuestion(active.id, { subject: e.target.value as ChallengeSubject, section: SUBJECT_TAB_SECTIONS[e.target.value as ChallengeSubject][0] })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{SUBJECT_META[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">Раздел</label>
                  <select
                    value={active.section ?? ''}
                    onChange={e => patchQuestion(active.id, { section: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                  >
                    {SUBJECT_TAB_SECTIONS[active.subject].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">Тема</label>
                  <input
                    defaultValue={active.topic ?? ''}
                    key={`topic-${active.id}`}
                    onBlur={e => patchQuestion(active.id, { topic: e.target.value })}
                    placeholder="Пропорции"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">Сложность</label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patchQuestion(active.id, { difficulty: d })}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        active.difficulty === d ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-gray-500">Варианты ответов</label>
                {LETTERS.map(letter => {
                  const field = (`option_${letter.toLowerCase()}` as 'option_a')
                  const isCorrectAnswer = active.correct_answer === letter
                  return (
                    <div
                      key={letter}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 ${isCorrectAnswer ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-white'}`}
                    >
                      <button
                        type="button"
                        onClick={() => patchQuestion(active.id, { correct_answer: letter })}
                        aria-label={`Правильный ответ ${letter}`}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          isCorrectAnswer ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {letter}
                      </button>
                      <input
                        defaultValue={active[field]}
                        key={`${field}-${active.id}`}
                        onBlur={e => patchQuestion(active.id, { [field]: e.target.value } as Partial<DailyChallengeQuestion>)}
                        placeholder={`Вариант ${letter}`}
                        className="w-full min-w-0 flex-1 border-none bg-transparent text-sm text-gray-800 outline-none"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {preview && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Preview ученика</span>
              <button type="button" onClick={() => setPreview(false)} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
                <X size={16} />
              </button>
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${SUBJECT_META[active.subject].color}1A`, color: SUBJECT_META[active.subject].color }}>
              {SUBJECT_META[active.subject].icon} {SUBJECT_META[active.subject].label}
            </span>
            <p className="mt-3 text-base font-bold text-gray-900">{active.question_text || 'Текст вопроса...'}</p>
            <div className="mt-4 space-y-2">
              {LETTERS.map(letter => (
                <div key={letter} className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 ${active.correct_answer === letter ? 'border-[#1B4FD8] bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active.correct_answer === letter ? 'bg-[#1B4FD8] text-white' : 'bg-white text-gray-500'}`}>
                    {letter}
                  </span>
                  <span className="text-sm text-gray-700">{optionText(active, letter) || `Вариант ${letter}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление вопроса"
          message="Удалить этот вопрос из задания? Это действие необратимо."
          loading={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
