'use client'

import { useRef, useState } from 'react'
import { X, ImagePlus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  createAnnouncement, updateAnnouncement, ANNOUNCEMENT_TYPE_OPTIONS,
  type AdminAnnouncement, type AnnouncementType,
} from '@/lib/admin-data'

interface Props {
  announcement?: AdminAnnouncement
  onClose: () => void
  onSaved: () => void
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function AnnouncementFormModal({ announcement, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(announcement?.title ?? '')
  const [body, setBody] = useState(announcement?.body ?? '')
  const [type, setType] = useState<AnnouncementType>(announcement?.type ?? 'info')
  const [imageUrl, setImageUrl] = useState<string | null>(announcement?.image_url ?? null)
  const [isActive, setIsActive] = useState(announcement?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    setError('')
    if (!ACCEPTED_TYPES.includes(file.type)) { setError('Поддерживаются только JPEG, PNG и WebP'); return }
    if (file.size > MAX_IMAGE_BYTES) { setError('Файл слишком большой (макс. 5 МБ)'); return }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('announcements').upload(path, file, { upsert: true })
      if (uploadError) { setError('Не удалось загрузить изображение'); return }

      const { data } = supabase.storage.from('announcements').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Введите заголовок'); return }
    if (!body.trim()) { setError('Введите текст объявления'); return }

    setSaving(true)
    try {
      const payload = { title: title.trim(), body: body.trim(), isActive, imageUrl, type }
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
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
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">Тип</label>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    type === opt.value ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Текст *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              placeholder="Текст объявления..."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">Баннер</label>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, no next/image domain config */}
                <img src={imageUrl} alt="Баннер" className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  aria-label="Удалить баннер"
                  className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-6 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-60"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {uploading ? 'Загрузка...' : 'Загрузить баннер'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
            />
            <p className="mt-1 text-[11px] text-gray-400">JPEG, PNG или WebP, до 5 МБ</p>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Активно
          </label>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving || uploading}
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
