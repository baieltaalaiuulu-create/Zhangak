'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ListChecks, Pencil, Trash2 } from 'lucide-react'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import PracticeTestFormModal from '@/components/admin/practice/PracticeTestFormModal'
import {
  fetchPracticeTests,
  fetchLessons,
  setPracticeTestActive,
  deletePracticeTest,
  SUBJECT_LABELS,
  type AdminPracticeTest,
  type AdminLesson,
} from '@/lib/admin-data'

// Lists only lesson-linked practice tests (lessonId !== null) — standalone
// bank tests (lesson_id=null) live in the sibling "Банк вопросов" tab.
export default function LessonTestsTab() {
  const router = useRouter()
  const [tests, setTests] = useState<AdminPracticeTest[]>([])
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [formTarget, setFormTarget] = useState<AdminPracticeTest | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminPracticeTest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const load = async () => {
    const [testsData, lessonsData] = await Promise.all([fetchPracticeTests(), fetchLessons()])
    setTests(testsData.filter(t => t.lessonId !== null))
    setLessons(lessonsData)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const [testsData, lessonsData] = await Promise.all([fetchPracticeTests(), fetchLessons()])
      setTests(testsData.filter(t => t.lessonId !== null))
      setLessons(lessonsData)
      setLoading(false)
    }
    init()
  }, [])

  const openCreate = () => { setFormTarget(null); setFormOpen(true) }
  const openEdit = (test: AdminPracticeTest) => { setFormTarget(test); setFormOpen(true) }

  const handleToggleActive = async (test: AdminPracticeTest) => {
    setTogglingId(test.id)
    try {
      await setPracticeTestActive(test.id, !test.isActive)
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePracticeTest(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> Практика кошуу
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Название</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Предмет</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Урок</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Вопросы</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Время</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Активен</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Загрузка...</td></tr>
            ) : tests.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Тесты практики не найдены</td></tr>
            ) : tests.map((t, i) => (
              <tr key={t.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-3 font-semibold text-[#191B23]">{t.title}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${t.subject === 'math' ? 'bg-[#EEF2FF] text-[#1B4FD8]' : t.subject === 'kyr' ? 'bg-[#F5F3FF] text-[#7C3AED]' : 'bg-gray-100 text-gray-500'}`}>
                    {t.subject === 'all' ? 'Общий' : SUBJECT_LABELS[t.subject]}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500">
                  {t.lessonTitle ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3">
                  {t.lessonId ? (
                    <button onClick={() => router.push(`/admin/lessons/${t.lessonId}/questions`)}
                      className="flex items-center gap-1 text-gray-500 hover:text-[#1B4FD8]">
                      <ListChecks size={14} /> {t.questionCount}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400">
                      <ListChecks size={14} /> {t.questionCount}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-400">{t.timeLimitMinutes ? `${t.timeLimitMinutes} мин` : '—'}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(t)}
                    disabled={togglingId === t.id}
                    role="switch"
                    aria-checked={t.isActive}
                    aria-label="Переключить активность"
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${t.isActive ? 'bg-[#1B4FD8]' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${t.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(t)} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} aria-label="Удалить" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <PracticeTestFormModal
          test={formTarget}
          lessons={lessons}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление теста"
          message={`Удалить тест практики "${deleteTarget.title}" вместе со всеми вопросами? Это действие необратимо.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
