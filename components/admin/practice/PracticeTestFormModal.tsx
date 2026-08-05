'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  createPracticeTest,
  updatePracticeTest,
  SUBJECT_LABELS,
  type AdminPracticeTest,
  type AdminLesson,
} from '@/lib/admin-data'

interface Props {
  test: AdminPracticeTest | null
  lessons: AdminLesson[]
  onClose: () => void
  onSaved: () => void
}

export default function PracticeTestFormModal({ test, lessons, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(test?.title ?? '')
  const [subject, setSubject] = useState<'math' | 'kyr'>(test?.subject === 'kyr' ? 'kyr' : 'math')
  const [lessonId, setLessonId] = useState(test?.lessonId ?? '')
  const [timeLimit, setTimeLimit] = useState(test?.timeLimitMinutes ?? 30)
  const [maxAttempts, setMaxAttempts] = useState(test?.maxAttempts ?? 5)
  const [isActive, setIsActive] = useState(test?.isActive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Аталышын киргизиңиз'); return }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        subject,
        lessonId: lessonId || null,
        timeLimitMinutes: timeLimit || null,
        maxAttempts,
        isActive,
      }
      if (test) {
        await updatePracticeTest(test.id, payload)
      } else {
        await createPracticeTest(payload)
      }
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
          <h2 className="text-lg font-bold text-[#191B23]">{test ? 'Практиканы түзөтүү' : 'Жаңы практика'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Аталышы *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Урок</label>
            <select value={lessonId} onChange={e => setLessonId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
              <option value="">— Байланышы жок —</option>
              {lessons.map(l => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
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
              <label className="mb-1 block text-xs font-semibold text-gray-500">Убакыт чеги (мүн)</label>
              <input type="number" min={0} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Аракеттердин макс. саны</label>
            <input type="number" min={1} value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Активдүү
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
