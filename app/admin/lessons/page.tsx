'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ListChecks, Pencil, Trash2, ChevronLeft, ChevronRight, BookOpen, Calculator } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import LessonEditModal from '@/components/admin/lessons/LessonEditModal'
import { fetchLessons, deleteLesson, SUBJECT_LABELS, type AdminLesson } from '@/lib/admin-data'

const PAGE_SIZE = 10

type SubjectFilter = 'all' | 'math' | 'kyr'

const TABS: { id: SubjectFilter; label: string; icon: typeof BookOpen }[] = [
  { id: 'all', label: 'Все', icon: BookOpen },
  { id: 'math', label: 'Математика', icon: Calculator },
  { id: 'kyr', label: 'Кыргыз тили', icon: BookOpen },
]

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SubjectFilter>('all')
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<AdminLesson | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminLesson | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const load = async () => {
    const data = await fetchLessons()
    setLessons(data)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const data = await fetchLessons()
      setLessons(data)
      setLoading(false)
    }
    init()
  }, [])

  const filtered = useMemo(() => tab === 'all' ? lessons : lessons.filter(l => l.subject === tab), [lessons, tab])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const changeTab = (t: SubjectFilter) => { setTab(t); setPage(1) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteLesson(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Уроки" actionLabel="Добавить урок" actionIcon={Plus} onAction={() => router.push('/admin/lessons/new')} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        <div className="flex gap-2">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => changeTab(t.id)}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'border-[#1B4FD8] bg-[#EEF2FF] text-[#1B4FD8]' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                <Icon size={16} />{t.label}
              </button>
            )
          })}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Название</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Предмет</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Статус</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Вопросы</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Создан</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Загрузка...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Уроки не найдены</td></tr>
              ) : paged.map((l, i) => (
                <tr key={l.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-4 py-3 text-gray-400">{l.order_number}</td>
                  <td className="px-3 py-3 font-semibold text-[#191B23]">{l.title}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.subject === 'math' ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'bg-[#F5F3FF] text-[#7C3AED]'}`}>
                      {SUBJECT_LABELS[l.subject]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {l.status === 'active' ? 'Активен' : 'Черновик'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => router.push(`/admin/lessons/${l.id}/questions`)}
                      className="flex items-center gap-1 text-gray-500 hover:text-[#1B4FD8]">
                      <ListChecks size={14} /> {l.questionCount}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-gray-400">{new Date(l.created_at).toLocaleDateString('ru')}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditTarget(l)} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(l)} aria-label="Удалить" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {editTarget && <LessonEditModal lesson={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление урока"
          message={`Удалить урок "${deleteTarget.title}" вместе со всеми вопросами? Это действие необратимо.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
