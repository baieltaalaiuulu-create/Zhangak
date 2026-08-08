'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  createUniversity, updateUniversity, type AdminUniversity, type UniversityPayload,
} from '@/lib/admin-universities-data'

interface Props {
  university?: AdminUniversity
  onClose: () => void
  onSaved: () => void
}

const LANGUAGE_OPTIONS = ['Русский', 'Кыргызский', 'Турецкий', 'Английский']

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-600">
      {label}
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#1B4FD8]' : 'bg-gray-200'}`}
        aria-label={label}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

export default function UniversityFormModal({ university, onClose, onSaved }: Props) {
  const [name, setName] = useState(university?.name ?? '')
  const [city, setCity] = useState(university?.city ?? 'Бишкек')
  const [type, setType] = useState<'government' | 'private'>(university?.type ?? 'government')
  const [description, setDescription] = useState(university?.description ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(university?.website_url ?? '')
  const [logoUrl, setLogoUrl] = useState(university?.logo_url ?? '')
  const [minScore, setMinScore] = useState(university?.min_score != null ? String(university.min_score) : '')
  const [avgScore, setAvgScore] = useState(university?.avg_score != null ? String(university.avg_score) : '')
  const [tuitionMin, setTuitionMin] = useState(university?.tuition_min != null ? String(university.tuition_min) : '')
  const [tuitionMax, setTuitionMax] = useState(university?.tuition_max != null ? String(university.tuition_max) : '')
  const [dormitory, setDormitory] = useState(university?.dormitory ?? false)
  const [budgetPlaces, setBudgetPlaces] = useState(university?.budget_places ?? true)
  const [rating, setRating] = useState(university?.rating != null ? String(university.rating) : '')
  const [languages, setLanguages] = useState<string[]>(university?.languages ?? [])
  const [totalSpecialties, setTotalSpecialties] = useState(university?.total_specialties != null ? String(university.total_specialties) : '')
  const [isActive, setIsActive] = useState(university?.is_active ?? true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])
  }

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) { setError('Введите название'); return }
    if (!city.trim()) { setError('Введите город'); return }

    setSaving(true)
    try {
      const payload: UniversityPayload = {
        name: name.trim(),
        city: city.trim(),
        type,
        description: description.trim() || null,
        logoUrl: logoUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        minScore: numOrNull(minScore),
        avgScore: numOrNull(avgScore),
        tuitionMin: numOrNull(tuitionMin),
        tuitionMax: numOrNull(tuitionMax),
        dormitory,
        budgetPlaces,
        rating: numOrNull(rating),
        languages,
        totalSpecialties: numOrNull(totalSpecialties),
        isActive,
      }
      if (university) {
        await updateUniversity(university.id, payload)
      } else {
        await createUniversity(payload)
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">{university ? 'Редактировать университет' : 'Добавить университет'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Кыргызско-Турецкий университет «Манас»"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Город *</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Бишкек"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Тип *</label>
              <select value={type} onChange={e => setType(e.target.value as 'government' | 'private')}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                <option value="government">Государственный</option>
                <option value="private">Частный</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Краткое описание университета..."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Сайт</label>
              <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Логотип (URL)</label>
              <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Мин. балл</label>
              <input type="number" value={minScore} onChange={e => setMinScore(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Средний балл</label>
              <input type="number" value={avgScore} onChange={e => setAvgScore(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Стоимость от</label>
              <input type="number" value={tuitionMin} onChange={e => setTuitionMin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Стоимость до</label>
              <input type="number" value={tuitionMax} onChange={e => setTuitionMax(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Рейтинг (0–5)</label>
              <input type="number" step="0.1" min="0" max="5" value={rating} onChange={e => setRating(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Всего специальностей</label>
              <input type="number" value={totalSpecialties} onChange={e => setTotalSpecialties(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-500">Языки обучения</label>
            <div className="flex flex-wrap gap-3">
              {LANGUAGE_OPTIONS.map(lang => (
                <label key={lang} className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                  <input type="checkbox" checked={languages.includes(lang)} onChange={() => toggleLanguage(lang)}
                    className="h-4 w-4 rounded border-gray-300" />
                  {lang}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
            <Toggle checked={dormitory} onChange={setDormitory} label="Общежитие" />
            <Toggle checked={budgetPlaces} onChange={setBudgetPlaces} label="Бюджетные места" />
            <Toggle checked={isActive} onChange={setIsActive} label="Активен" />
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
