'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { updateAdminLesson, type AdminLesson } from '@/lib/admin-learning-client'

interface Props {
  lesson: AdminLesson
  onClose: () => void
  onSaved: () => void
}

function optionalText(value: string): string | null {
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

function parseInteger(value: string, label: string, max: number): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`Введите корректный ${label}`)
  return parsed
}

export default function LessonEditModal({ lesson, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(lesson.title)
  const [description, setDescription] = useState(lesson.description ?? '')
  const [subject, setSubject] = useState(lesson.subject ?? '')
  const [section, setSection] = useState(lesson.section ?? '')
  const [topic, setTopic] = useState(lesson.topic ?? '')
  const [lessonNumber, setLessonNumber] = useState(String(lesson.lessonNumber))
  const [durationMinutes, setDurationMinutes] = useState(lesson.durationMinutes === null ? '' : String(lesson.durationMinutes))
  const [contentUrl, setContentUrl] = useState(lesson.contentUrl ?? '')
  const [lessonDate, setLessonDate] = useState(lesson.lessonDate ?? '')
  const [isTest, setIsTest] = useState(lesson.isTest)
  const [isPublished, setIsPublished] = useState(lesson.isPublished)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    setSaving(true)
    try {
      const parsedDuration = durationMinutes.trim() === ''
        ? null
        : parseInteger(durationMinutes, 'время урока', 600)
      await updateAdminLesson(lesson.id, {
        lessonNumber: parseInteger(lessonNumber, 'номер урока', 10_000),
        title: title.trim(),
        description: optionalText(description),
        subject: optionalText(subject),
        section: optionalText(section),
        topic: optionalText(topic),
        lessonDate: optionalText(lessonDate),
        durationMinutes: parsedDuration,
        contentUrl: optionalText(contentUrl),
        isTest,
        isPublished,
      })
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить урок')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()} aria-labelledby="lesson-edit-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="lesson-edit-title" className="text-lg font-bold text-[#191B23]">Редактировать урок</h2>
            <p className="mt-1 text-sm text-gray-500">Изменения сохраняются в основном backend Zhangak.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
            <input value={title} onChange={event => setTitle(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Описание</label>
            <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Номер урока</label>
              <input type="number" min={1} max={10_000} value={lessonNumber} onChange={event => setLessonNumber(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Длительность, мин.</label>
              <input type="number" min={1} max={600} value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} placeholder="Не указана"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Предмет</label>
              <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Математика"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Раздел</label>
              <input value={section} onChange={event => setSection(event.target.value)} placeholder="Алгебра"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Тема</label>
            <input value={topic} onChange={event => setTopic(event.target.value)} placeholder="Квадратные уравнения"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Дата урока</label>
              <input type="date" value={lessonDate} onChange={event => setLessonDate(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Ссылка на материал</label>
              <input value={contentUrl} onChange={event => setContentUrl(event.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <input type="checkbox" checked={isTest} onChange={event => setIsTest(event.target.checked)} />
              Это тестовый урок
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)} />
              Опубликовать для учеников
            </label>
          </div>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-60">
              Отмена
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
