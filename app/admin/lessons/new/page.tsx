'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminTopbar from '@/components/admin/AdminTopbar'
import LessonCard from '@/components/student/LessonCard'
import { SUBJECT_LABELS, createLesson } from '@/lib/admin-data'
import type { Lesson } from '@/lib/lessons-data'

export default function AdminNewLessonPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState<'math' | 'kyr'>('math')
  const [orderNumber, setOrderNumber] = useState(1)
  const [videoUrl, setVideoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const previewLesson: Lesson = {
    id: 'preview',
    title: title || 'Урок без названия',
    description: description || null,
    subject,
    video_url: videoUrl || null,
    order_number: orderNumber,
  }

  const handleSave = async (activate: boolean) => {
    setError('')
    if (!title.trim()) { setError('Введите название'); return }

    setSaving(true)
    try {
      await createLesson({ title: title.trim(), description, subject, order_number: orderNumber, video_url: videoUrl }, activate)
      router.push('/admin/lessons')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Новый урок" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название урока"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Описание</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Краткое описание"
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
                <label className="mb-1 block text-xs font-semibold text-gray-500">Порядок</label>
                <input type="number" min={1} value={orderNumber} onChange={e => setOrderNumber(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Ссылка на YouTube</label>
              <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => handleSave(true)} disabled={saving}
                className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Сохранение...' : 'Сохранить (Активен)'}
              </button>
              <button type="button" onClick={() => handleSave(false)} disabled={saving}
                className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-60">
                Сохранить (Черновик)
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Предпросмотр</div>
            <div className="pointer-events-none h-56">
              <LessonCard lesson={previewLesson} status="current" questionCount={0} courseProgress={0} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
