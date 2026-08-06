'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Check } from 'lucide-react'
import {
  createMockSession,
  updateMockSession,
  type AdminMockSession,
  type MockSessionPayload,
} from '@/lib/admin-data'
import { SECTION_LABELS } from '@/lib/practice-data'

interface Props {
  session: AdminMockSession | null
  onClose: () => void
  onSaved: () => void
}

const DEFAULT_DURATION = 180

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in *local* time,
// not the ISO/UTC string the DB stores — these convert both directions.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function MockSessionFormModal({ session, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(session?.title ?? '')
  const [scheduledLocal, setScheduledLocal] = useState(isoToLocalInput(session?.scheduledAt ?? null))
  const [durationMinutes, setDurationMinutes] = useState(session?.durationMinutes ?? DEFAULT_DURATION)
  const [isActive, setIsActive] = useState(session?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Введите название'); return }

    setSaving(true)
    try {
      const payload: MockSessionPayload = {
        title: title.trim(),
        scheduledAt: localInputToIso(scheduledLocal),
        durationMinutes,
        isActive,
      }
      if (session) {
        await updateMockSession(session.id, payload)
        onSaved()
        onClose()
      } else {
        // A brand-new session has zero questions — hand the admin straight
        // to the question editor instead of silently closing on a session
        // nobody can take yet.
        const newId = await createMockSession(payload)
        onSaved()
        setCreatedId(newId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка')
    } finally {
      setSaving(false)
    }
  }

  const sectionEntries = session ? Object.entries(session.sectionCounts) : []

  if (createdId !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Check size={22} className="text-green-600" />
          </div>
          <h2 className="mt-3 text-lg font-bold text-[#191B23]">Пробный ОРТ создан</h2>
          <p className="mt-1 text-sm text-gray-500">В нём пока нет вопросов — добавьте их сейчас или позже из списка.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={`/admin/mock/${createdId}/questions`}
              onClick={onClose}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              Добавить вопросы →
            </Link>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Позже
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">{session ? 'Редактировать пробный ОРТ' : 'Новый пробный ОРТ'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Например: Пробный ОРТ — Август"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Дата и время</label>
              <input type="datetime-local" value={scheduledLocal} onChange={e => setScheduledLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              <p className="mt-1 text-[11px] text-gray-400">Оставьте пустым — тест будет доступен сразу</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Длительность (мин)</label>
              <input type="number" min={1} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          {session && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Вопросы по разделам</label>
              {sectionEntries.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">Вопросов нет — добавьте после сохранения</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sectionEntries.map(([section, count]) => (
                    <span key={section} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                      {SECTION_LABELS[section] ?? section}: {count}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-gray-400">
                Управляйте вопросами через <Link href={`/admin/mock/${session.id}/questions`} onClick={onClose} className="font-semibold text-[#1B4FD8] hover:underline">«Вопросы →»</Link> в списке
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Активен
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
