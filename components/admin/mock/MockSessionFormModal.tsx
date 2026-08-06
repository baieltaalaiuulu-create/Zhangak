'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
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

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Аталышын киргизиңиз'); return }

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
      } else {
        await createMockSession(payload)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ката кетти')
    } finally {
      setSaving(false)
    }
  }

  const sectionEntries = session ? Object.entries(session.sectionCounts) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">{session ? 'Пробный ОРТ түзөтүү' : 'Жаңы пробный ОРТ'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Аталышы *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Мисалы: Пробный ОРТ — Август"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Дата жана убакыт</label>
              <input type="datetime-local" value={scheduledLocal} onChange={e => setScheduledLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              <p className="mt-1 text-[11px] text-gray-400">Бош калтырсаңыз — тест дароо жеткиликтүү болот</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Узактыгы (мүн)</label>
              <input type="number" min={1} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          {session && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Суроолор бөлүм боюнча</label>
              {sectionEntries.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">Суроолор жок — сактагандан кийин кошуңуз</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sectionEntries.map(([section, count]) => (
                    <span key={section} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                      {SECTION_LABELS[section] ?? section}: {count}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-gray-400">Суроолорду сактагандан кийин тизмедеги «Вопросы →» аркылуу башкарасыз</p>
            </div>
          )}

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
