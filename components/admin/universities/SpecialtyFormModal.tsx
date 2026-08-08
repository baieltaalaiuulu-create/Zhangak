'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  createSpecialty, updateSpecialty, type AdminSpecialty, type SpecialtyPayload,
} from '@/lib/admin-universities-data'

interface Props {
  universityId: string
  specialty?: AdminSpecialty
  onClose: () => void
  onSaved: () => void
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

export default function SpecialtyFormModal({ universityId, specialty, onClose, onSaved }: Props) {
  const [name, setName] = useState(specialty?.name ?? '')
  const [faculty, setFaculty] = useState(specialty?.faculty ?? '')
  const [minScore, setMinScore] = useState(specialty?.min_score != null ? String(specialty.min_score) : '')
  const [tuition, setTuition] = useState(specialty?.tuition != null ? String(specialty.tuition) : '')
  const [language, setLanguage] = useState(specialty?.language ?? 'Русский')
  const [form, setForm] = useState(specialty?.form ?? 'Очная')
  const [type, setType] = useState(specialty?.type ?? 'Бюджет')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) { setError('Введите название специальности'); return }

    setSaving(true)
    try {
      const payload: SpecialtyPayload = {
        universityId,
        name: name.trim(),
        faculty: faculty.trim() || null,
        minScore: numOrNull(minScore),
        tuition: numOrNull(tuition),
        language: language.trim() || null,
        form,
        type,
      }
      if (specialty) {
        await updateSpecialty(specialty.id, payload)
      } else {
        await createSpecialty(payload)
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
          <h2 className="text-lg font-bold text-[#191B23]">{specialty ? 'Редактировать специальность' : 'Новая специальность'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Компьютерные науки"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Факультет</label>
            <input value={faculty} onChange={e => setFaculty(e.target.value)} placeholder="Например: Инженерный факультет"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Мин. балл</label>
              <input type="number" value={minScore} onChange={e => setMinScore(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Стоимость в год</label>
              <input type="number" value={tuition} onChange={e => setTuition(e.target.value)} placeholder="Пусто = бесплатно"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Язык обучения</label>
            <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Например: Русский, Кыргызский"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Форма обучения</label>
              <select value={form} onChange={e => setForm(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                <option value="Очная">Очная</option>
                <option value="Заочная">Заочная</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Тип</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                <option value="Бюджет">Бюджет</option>
                <option value="Коммерция">Коммерция</option>
              </select>
            </div>
          </div>

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
