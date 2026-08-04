'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import {
  fetchLessonById, ensurePracticeTestForLesson, fetchQuestionsForTest,
  addQuestion, updateQuestion, deleteQuestion,
  SUBJECT_LABELS, SECTION_OPTIONS,
  type AdminQuestion, type QuestionPayload,
} from '@/lib/admin-data'

const ANSWER_OPTIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D']

const emptyForm: QuestionPayload = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', section: 'general',
}

export default function AdminLessonQuestionsPage() {
  const params = useParams<{ id: string }>()
  const lessonId = params.id
  const router = useRouter()

  const [lesson, setLesson] = useState<{ id: string; title: string; subject: 'math' | 'kyr' } | null>(null)
  const [testId, setTestId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<AdminQuestion[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState<QuestionPayload>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const init = async () => {
      const l = await fetchLessonById(lessonId)
      if (!l) { router.push('/admin/lessons'); return }
      setLesson(l)
      const test = await ensurePracticeTestForLesson(l)
      setTestId(test.id)
      const qs = await fetchQuestionsForTest(test.id)
      setQuestions(qs)
      setLoading(false)
    }
    init()
  }, [lessonId, router])

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setError('') }

  const startEdit = (q: AdminQuestion) => {
    setForm({
      question_text: q.question_text ?? '',
      option_a: q.option_a ?? '',
      option_b: q.option_b ?? '',
      option_c: q.option_c ?? '',
      option_d: q.option_d ?? '',
      correct_answer: (q.correct_answer as 'A' | 'B' | 'C' | 'D') ?? 'A',
      section: q.section ?? 'general',
    })
    setEditingId(q.id)
    setError('')
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.question_text.trim()) { setError('Суроонун текстин киргизиңиз'); return }
    if (!form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) { setError('Бардык варианттарды толтуруңуз'); return }
    if (!testId) return

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
      }
      if (editingId) {
        await updateQuestion(editingId, payload)
      } else {
        await addQuestion(testId, payload, questions.length + 1)
      }
      const qs = await fetchQuestionsForTest(testId)
      setQuestions(qs)
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ката кетти')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !testId) return
    setDeleting(true)
    try {
      await deleteQuestion(deleteTarget.id)
      const qs = await fetchQuestionsForTest(testId)
      setQuestions(qs)
      if (editingId === deleteTarget.id) resetForm()
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title={lesson ? `Суроолор — ${lesson.title}` : 'Суроолор'} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <button onClick={() => router.push('/admin/lessons')} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#1B4FD8]">
          <ArrowLeft size={15} /> Уроктарга кайтуу
        </button>

        {lesson && (
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${lesson.subject === 'math' ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'bg-[#F5F3FF] text-[#7C3AED]'}`}>
            {SUBJECT_LABELS[lesson.subject]}
          </span>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">
              Суроолор ({questions.length})
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Жүктөлүүдө...</div>
            ) : questions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Суроолор жок — оңдон кошуңуз</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {questions.map((q, i) => (
                  <div key={q.id} className={`flex items-start gap-3 px-4 py-3 ${editingId === q.id ? 'bg-[#EEF2FF]' : ''}`}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1B4FD8] text-xs font-bold text-white">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-[#191B23]">{q.question_text || '—'}</p>
                      <span className="mt-1 inline-block text-xs font-bold text-green-600">Туура: {q.correct_answer}</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => startEdit(q)} aria-label="Түзөтүү" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(q)} aria-label="Өчүрүү" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#191B23]">{editingId ? 'Суроону түзөтүү' : 'Жаңы суроо'}</h2>
              {editingId && (
                <button onClick={resetForm} className="text-xs font-semibold text-gray-400 hover:text-[#1B4FD8]">Жокко чыгаруу</button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Суроонун тексти *</label>
              <textarea value={form.question_text} onChange={e => setForm(p => ({ ...p, question_text: e.target.value }))} rows={3}
                placeholder="Суроону жазыңыз..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ANSWER_OPTIONS.map(letter => {
                const key = `option_${letter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'
                const isCorrect = form.correct_answer === letter
                return (
                  <div key={letter} className="flex items-center gap-2">
                    <button type="button" onClick={() => setForm(p => ({ ...p, correct_answer: letter }))}
                      aria-label={`Туура жооп ${letter}`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${isCorrect ? 'bg-[#1B4FD8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {letter}
                    </button>
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={`${letter} варианты`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20 ${isCorrect ? 'border-[#1B4FD8] bg-[#EEF2FF]' : 'border-gray-200'}`} />
                  </div>
                )
              })}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Бөлүм</label>
              <select value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                {SECTION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

            <button type="button" onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              <Plus size={16} />
              {saving ? 'Сакталууда...' : editingId ? 'Сактоо' : 'Суроо кошуу'}
            </button>
          </div>

        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          title="Суроону өчүрүү"
          message="Бул суроону өчүрөсүзбү? Бул аракетти артка кайтаруу мүмкүн эмес."
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
