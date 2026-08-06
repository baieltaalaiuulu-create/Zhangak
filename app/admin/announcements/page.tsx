'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import AnnouncementFormModal from '@/components/admin/announcements/AnnouncementFormModal'
import {
  fetchAnnouncements, deleteAnnouncement, setAnnouncementActive,
  type AdminAnnouncement,
} from '@/lib/admin-data'

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [formTarget, setFormTarget] = useState<{ announcement?: AdminAnnouncement } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const data = await fetchAnnouncements()
    setAnnouncements(data)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const data = await fetchAnnouncements()
      setAnnouncements(data)
      setLoading(false)
    }
    init()
  }, [])

  const handleToggleActive = async (a: AdminAnnouncement) => {
    await setAnnouncementActive(a.id, !a.is_active)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAnnouncement(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Объявления" actionLabel="Добавить объявление" actionIcon={Plus} onAction={() => setFormTarget({})} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Загрузка...</div>
        ) : announcements.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Объявлений пока нет</div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#191B23]">{a.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {a.is_active ? 'Активно' : 'Отключено'}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500">{a.body}</p>
                    <p className="mt-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('ru')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => handleToggleActive(a)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${a.is_active ? 'bg-[#1B4FD8]' : 'bg-gray-200'}`}
                      aria-label="Переключить активность">
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${a.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => setFormTarget({ announcement: a })} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(a)} aria-label="Удалить" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formTarget && (
        <AnnouncementFormModal
          announcement={formTarget.announcement}
          onClose={() => setFormTarget(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление объявления"
          message={`Удалить объявление "${deleteTarget.title}"? Это действие необратимо.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
