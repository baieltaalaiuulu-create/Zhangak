'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createAnnouncement, updateAnnouncement, type AdminAnnouncement } from '@/lib/admin-data'

interface Props {
  announcement?: AdminAnnouncement
  onClose: () => void
  onSaved: () => void
}

export default function AnnouncementFormModal({ announcement, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(announcement?.title ?? '')
  const [body, setBody] = useState(announcement?.body ?? '')
  const [isActive, setIsActive] = useState(announcement?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Введите заголовок'); return }
    if (!body.trim()) { setError('Введите текст объявления'); return }

    setSaving(true)
    try {
      const payload = { title: title.trim(), body: body.trim(), isActive }
      if (announcement) {
        await updateAnnouncement(announcement.id, payload)
      } else {
        await createAnnouncement(payload)
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
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">{announcement ? 'Редактировать объявление' : 'Новое объявление'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Заголовок *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Изменение расписания"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Текст *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              placeholder="Текст объявления..."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Активно
          </label>

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
      </div>
    </div>
  )
}
