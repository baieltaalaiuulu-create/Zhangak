'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { setLessonActive, SUBJECT_LABELS, type AdminLesson } from '@/lib/admin-data'

interface Props {
  lesson: AdminLesson
  onClose: () => void
  onSaved: () => void
}

export default function LessonEditModal({ lesson, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(lesson.title)
  const [description, setDescription] = useState(lesson.description ?? '')
  const [subject, setSubject] = useState<'math' | 'kyr'>(lesson.subject)
  const [orderNumber, setOrderNumber] = useState(lesson.order_number)
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? '')
  const [active, setActive] = useState(lesson.status === 'active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Аталышын киргизиңиз'); return }

    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('practice_lessons')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          subject,
          order_number: orderNumber,
          video_url: videoUrl.trim() || null,
        })
        .eq('id', lesson.id)
      if (updateError) throw new Error(updateError.message)

      await setLessonActive({ id: lesson.id, title: title.trim(), subject }, active)

      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ката кетти')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">Уроктту түзөтүү</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Аталышы *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Сүрөттөмө</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Предмет</label>
              <div className="flex gap-2">
                {(Object.keys(SUBJECT_LABELS) as ('math' | 'kyr')[]).map(s => (
                  <button key={s} type="button" onClick={() => setSubject(s)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${subject === s ? 'border-[#1B4FD8] bg-[#EEF2FF] text-[#1B4FD8]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {SUBJECT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Тартиби</label>
              <input type="number" value={orderNumber} onChange={e => setOrderNumber(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Видео шилтеме</label>
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Активдүү
          </label>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Сакталууда...' : 'Сактоо'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Жокко чыгаруу
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
