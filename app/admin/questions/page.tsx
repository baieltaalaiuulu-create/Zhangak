'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import QuestionFormModal from '@/components/admin/questions/QuestionFormModal'
import { SECTION_LABELS } from '@/lib/practice-data'
import {
  fetchAllQuestions, fetchLessons, deleteQuestion, SUBJECT_LABELS, SECTION_OPTIONS,
  type AllQuestionRow, type AdminLesson,
} from '@/lib/admin-data'

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<AllQuestionRow[]>([])
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [loading, setLoading] = useState(true)

  const [subjectFilter, setSubjectFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [lessonFilter, setLessonFilter] = useState('')

  const [formTarget, setFormTarget] = useState<{ mode: 'create' | 'edit'; question: AllQuestionRow | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AllQuestionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const [qs, ls] = await Promise.all([fetchAllQuestions(), fetchLessons()])
    setQuestions(qs)
    setLessons(ls)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const [qs, ls] = await Promise.all([fetchAllQuestions(), fetchLessons()])
      setQuestions(qs)
      setLessons(ls)
      setLoading(false)
    }
    init()
  }, [])

  const filtered = useMemo(() => questions.filter(q => {
    if (subjectFilter && q.subject !== subjectFilter) return false
    if (sectionFilter && q.section !== sectionFilter) return false
    if (lessonFilter === '__bank__' && q.lessonId) return false
    if (lessonFilter && lessonFilter !== '__bank__' && q.lessonId !== lessonFilter) return false
    return true
  }), [questions, subjectFilter, sectionFilter, lessonFilter])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteQuestion(deleteTarget.id)
      await load()
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Вопросы" actionLabel="Добавить вопрос" actionIcon={Plus} onAction={() => setFormTarget({ mode: 'create', question: null })} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Все предметы</option>
            <option value="math">{SUBJECT_LABELS.math}</option>
            <option value="kyr">{SUBJECT_LABELS.kyr}</option>
            <option value="all">Смешанный</option>
          </select>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Все разделы</option>
            {SECTION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={lessonFilter} onChange={e => setLessonFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Все уроки</option>
            <option value="__bank__">Без урока (банк)</option>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Вопрос</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Раздел</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Ответ</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Урок</th>
                <th className="w-16 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Фото</th>
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Загрузка...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Вопросы не найдены</td></tr>
              ) : filtered.map((q, i) => (
                <tr key={q.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="max-w-[360px] px-4 py-3">
                    <p className="truncate text-sm font-semibold text-[#191B23]">{q.question_text || '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                      {SECTION_LABELS[q.section] ?? q.section}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm font-bold text-green-600">{q.correct_answer}</td>
                  <td className="px-3 py-3 text-gray-500">{q.lessonTitle ?? 'Банк вопросов'}</td>
                  <td className="px-3 py-3 text-center">
                    {q.image_url && <ImageIcon size={15} className="mx-auto text-gray-400" />}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setFormTarget({ mode: 'edit', question: q })} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(q)} aria-label="Удалить" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formTarget && (
        <QuestionFormModal
          question={formTarget.question}
          lessons={lessons}
          onClose={() => setFormTarget(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление вопроса"
          message="Удалить этот вопрос? Это действие необратимо."
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
