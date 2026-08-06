'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ClipboardPaste } from 'lucide-react'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import BulkAddModal from './BulkAddModal'
import { SECTION_LABELS } from '@/lib/practice-data'
import {
  fetchBankQuestions,
  addBankQuestion,
  updateQuestion,
  deleteQuestion,
  BANK_SECTION_OPTIONS,
  DIFFICULTY_OPTIONS,
  type BankQuestion,
  type BankQuestionPayload,
} from '@/lib/admin-data'

const ANSWER_OPTIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D']

const emptyForm: BankQuestionPayload = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', section: 'math', topic: '', difficulty: 'medium',
}

export default function QuestionBankTab() {
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [sectionFilter, setSectionFilter] = useState<string>('all')

  const [form, setForm] = useState<BankQuestionPayload>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const load = async () => {
    const qs = await fetchBankQuestions()
    setQuestions(qs)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const qs = await fetchBankQuestions()
      setQuestions(qs)
      setLoading(false)
    }
    init()
  }, [])

  const visible = sectionFilter === 'all' ? questions : questions.filter(q => q.section === sectionFilter)

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setError('') }

  const startEdit = (q: BankQuestion) => {
    setForm({
      question_text: q.question_text ?? '',
      option_a: q.option_a ?? '',
      option_b: q.option_b ?? '',
      option_c: q.option_c ?? '',
      option_d: q.option_d ?? '',
      correct_answer: (q.correct_answer as 'A' | 'B' | 'C' | 'D') ?? 'A',
      section: q.section,
      topic: q.topic ?? '',
      difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
    })
    setEditingId(q.id)
    setError('')
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.question_text.trim()) { setError('Суроонун текстин киргизиңиз'); return }
    if (!form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) { setError('Бардык варианттарды толтуруңуз'); return }
    if (!form.topic.trim()) { setError('Теманы киргизиңиз'); return }

    setSaving(true)
    try {
      const payload: BankQuestionPayload = {
        question_text: form.question_text.trim(),
        option_a: form.option_a.trim(),
        option_b: form.option_b.trim(),
        option_c: form.option_c.trim(),
        option_d: form.option_d.trim(),
        correct_answer: form.correct_answer,
        section: form.section,
        topic: form.topic.trim(),
        difficulty: form.difficulty,
      }
      if (editingId) {
        await updateQuestion(editingId, payload)
      } else {
        await addBankQuestion(payload)
      }
      await load()
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ката кетти')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteQuestion(deleteTarget.id)
      await load()
      if (editingId === deleteTarget.id) resetForm()
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
          <option value="all">Бардык бөлүмдөр</option>
          {BANK_SECTION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="button" onClick={() => setBulkOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          <ClipboardPaste size={16} /> Массалык кошуу
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 items-start">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">
            Суроолор ({visible.length})
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Жүктөлүүдө...</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Суроолор жок — оңдон кошуңуз</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visible.map(q => (
                <div key={q.id} className={`flex items-start gap-3 px-4 py-3 ${editingId === q.id ? 'bg-[#EEF2FF]' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                        {SECTION_LABELS[q.section] ?? q.section}
                      </span>
                      {q.topic && (
                        <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#1B4FD8]">{q.topic}</span>
                      )}
                      <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-400">
                        {DIFFICULTY_OPTIONS.find(d => d.value === q.difficulty)?.label ?? q.difficulty}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#191B23]">{q.question_text || '—'}</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Бөлүм</label>
              <select value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                {BANK_SECTION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Татаалдык</label>
              <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Тема *</label>
            <input value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
              placeholder="Мисалы: Пайыздар"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
            <Plus size={16} />
            {saving ? 'Сакталууда...' : editingId ? 'Сактоо' : 'Суроо кошуу'}
          </button>
        </div>
      </div>

      {bulkOpen && <BulkAddModal onClose={() => setBulkOpen(false)} onDone={load} />}
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
