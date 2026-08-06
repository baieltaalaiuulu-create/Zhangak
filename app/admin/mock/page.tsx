'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ListChecks, Pencil, Trash2, Users } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import MockSessionFormModal from '@/components/admin/mock/MockSessionFormModal'
import {
  fetchMockSessions,
  setPracticeTestActive,
  deletePracticeTest,
  type AdminMockSession,
} from '@/lib/admin-data'

function formatScheduled(iso: string | null): string {
  if (!iso) return 'Без расписания'
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminMockPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<AdminMockSession[]>([])
  const [loading, setLoading] = useState(true)
  const [formTarget, setFormTarget] = useState<AdminMockSession | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminMockSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const load = async () => {
    setSessions(await fetchMockSessions())
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      setSessions(await fetchMockSessions())
      setLoading(false)
    }
    init()
  }, [])

  const openCreate = () => { setFormTarget(null); setFormOpen(true) }
  const openEdit = (session: AdminMockSession) => { setFormTarget(session); setFormOpen(true) }

  const handleToggleActive = async (session: AdminMockSession) => {
    setTogglingId(session.id)
    try {
      await setPracticeTestActive(session.id, !session.isActive)
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
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Пробный ОРТ" actionLabel="Создать пробный ОРТ" actionIcon={Plus} onAction={openCreate} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Аталышы</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Дата/убакыт</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Узактыгы</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Суроолор</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Катталды</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Активдүү</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Аракеттер</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Жүктөлүүдө...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Пробный ОРТ табылган жок</td></tr>
              ) : sessions.map((s, i) => (
                <tr key={s.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-[#191B23]">{s.title}</td>
                  <td className="px-3 py-3 text-gray-500">{formatScheduled(s.scheduledAt)}</td>
                  <td className="px-3 py-3 text-gray-400">{s.durationMinutes ? `${s.durationMinutes} мүн` : '—'}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => router.push(`/admin/mock/${s.id}/questions`)}
                      className="flex items-center gap-1 text-gray-500 hover:text-[#1B4FD8]">
                      <ListChecks size={14} /> {s.questionCount}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Users size={14} /> {s.registeredCount}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(s)}
                      disabled={togglingId === s.id}
                      role="switch"
                      aria-checked={s.isActive}
                      aria-label="Активдүүлүгүн которуштуруу"
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.isActive ? 'bg-[#1B4FD8]' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${s.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} aria-label="Түзөтүү" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(s)} aria-label="Өчүрүү" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <MockSessionFormModal
          session={formTarget}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Пробный ОРТ өчүрүү"
          message={`"${deleteTarget.title}" пробный ОРТ жана бардык суроолорун, каттоолорун өчүрөсүзбү? Бул аракетти артка кайтаруу мүмкүн эмес.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
