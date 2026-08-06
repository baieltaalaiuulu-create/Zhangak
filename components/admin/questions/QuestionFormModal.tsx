'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import QuestionImageUploader from '@/components/admin/QuestionImageUploader'
import {
  fetchQuestionById, ensurePracticeTestForLesson, addQuestion, updateQuestion, addBankQuestion,
  SECTION_OPTIONS, DIFFICULTY_OPTIONS,
  type AllQuestionRow, type QuestionPayload, type BankQuestionPayload, type LessonForTest,
} from '@/lib/admin-data'

interface Props {
  question: AllQuestionRow | null // null = create
  lessons: LessonForTest[]
  onClose: () => void
  onSaved: () => void
}

const ANSWER_OPTIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D']

interface FormState {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  section: string
  image_url: string | null
  lessonId: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
}

const emptyForm: FormState = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', section: 'math', image_url: null,
  lessonId: '', topic: '', difficulty: 'medium',
}

export default function QuestionFormModal({ question, lessons, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(!!question)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!question) return
    const load = async () => {
      const full = await fetchQuestionById(question.id)
      if (full) {
        setForm({
          question_text: full.question_text ?? '',
          option_a: full.option_a ?? '',
          option_b: full.option_b ?? '',
          option_c: full.option_c ?? '',
          option_d: full.option_d ?? '',
          correct_answer: (full.correct_answer as 'A' | 'B' | 'C' | 'D') ?? 'A',
          section: full.section ?? 'general',
          image_url: full.image_url ?? null,
          lessonId: question.lessonId ?? '',
          topic: '',
          difficulty: 'medium',
        })
      }
      setLoading(false)
    }
    load()
  }, [question])

  const handleSubmit = async () => {
    setError('')
    if (!form.question_text.trim()) { setError('Введите текст вопроса'); return }
    if (!form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) { setError('Заполните все варианты'); return }
    if (!question && !form.lessonId && !form.topic.trim()) { setError('Введите тему (для вопроса без урока)'); return }

    setSaving(true)
    try {
      const payload: QuestionPayload = {
        question_text: form.question_text.trim(),
        option_a: form.option_a.trim(),
        option_b: form.option_b.trim(),
        option_c: form.option_c.trim(),
        option_d: form.option_d.trim(),
        correct_answer: form.correct_answer,
        section: form.section,
        image_url: form.image_url ?? null,
      }

      if (question) {
        await updateQuestion(question.id, payload)
      } else if (form.lessonId) {
        const lesson = lessons.find(l => l.id === form.lessonId)
        if (!lesson) throw new Error('Урок не найден')
        const test = await ensurePracticeTestForLesson(lesson)
        await addQuestion(test.id, payload, 0)
      } else {
        const bankPayload: BankQuestionPayload = { ...payload, topic: form.topic.trim(), difficulty: form.difficulty }
        await addBankQuestion(bankPayload)
      }

      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">{question ? 'Редактировать вопрос' : 'Новый вопрос'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Загрузка...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Текст вопроса *</label>
              <textarea value={form.question_text} onChange={e => setForm(p => ({ ...p, question_text: e.target.value }))} rows={3}
                placeholder="Введите вопрос..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>

            <QuestionImageUploader
              imageUrl={form.image_url}
              onChange={url => setForm(p => ({ ...p, image_url: url }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ANSWER_OPTIONS.map(letter => {
                const key = `option_${letter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'
                const isCorrect = form.correct_answer === letter
                return (
                  <div key={letter} className="flex items-center gap-2">
                    <button type="button" onClick={() => setForm(p => ({ ...p, correct_answer: letter }))}
                      aria-label={`Правильный ответ ${letter}`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${isCorrect ? 'bg-[#1B4FD8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {letter}
                    </button>
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={`Вариант ${letter}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20 ${isCorrect ? 'border-[#1B4FD8] bg-[#EEF2FF]' : 'border-gray-200'}`} />
                  </div>
                )
              })}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Раздел</label>
              <select value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                {SECTION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {!question && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Урок</label>
                  <select value={form.lessonId} onChange={e => setForm(p => ({ ...p, lessonId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                    <option value="">— Без урока (банк вопросов) —</option>
                    {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </div>

                {!form.lessonId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">Тема *</label>
                      <input value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                        placeholder="Например: Проценты"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">Сложность</label>
                      <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                        {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" onClick={onClose}
                className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
