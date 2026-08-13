'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createAdminCourse, type AdminCourse } from '@/lib/admin-learning-client'

interface Props {
  onClose: () => void
  onCreated: (course: AdminCourse) => void
}

function optionalText(value: string): string | null {
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

export default function CourseCreateModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [level, setLevel] = useState('11 класс')
  const [subject, setSubject] = useState('Математика')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) {
      setError('Введите название курса')
      return
    }

    setSaving(true)
    try {
      const course = await createAdminCourse({
        name: name.trim(),
        code: optionalText(code)?.toLowerCase() ?? null,
        level: optionalText(level),
        subject: optionalText(subject),
        description: optionalText(description),
        isActive,
      })
      onCreated(course)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать курс')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()} aria-labelledby="course-create-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="course-create-title" className="text-lg font-bold text-[#191B23]">Новый учебный курс</h2>
            <p className="mt-1 text-sm text-gray-500">Сначала создайте курс, затем добавляйте в него уроки.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Например, Подготовка к ОРТ — математика"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Код курса</label>
              <input value={code} onChange={event => setCode(event.target.value)} placeholder="ort-math-11"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm lowercase outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              <p className="mt-1 text-[11px] text-gray-400">Латинские буквы, цифры, дефис или подчёркивание.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Уровень</label>
              <input value={level} onChange={event => setLevel(event.target.value)} placeholder="11 класс"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Предмет</label>
            <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Математика"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Описание</label>
            <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} placeholder="Кому и для чего предназначен курс"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />
            Курс активен
          </label>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Создание…' : 'Создать курс'}
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
