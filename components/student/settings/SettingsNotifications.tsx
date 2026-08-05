'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'

interface ToggleDef {
  key: string
  label: string
  sub: string
}

const TOGGLES: ToggleDef[] = [
  { key: 'lessons', label: 'Напоминания об уроках', sub: 'Когда пора пройти следующий урок' },
  { key: 'results', label: 'Результаты тестов', sub: 'Когда готовы результаты пройденного теста' },
  { key: 'announcements', label: 'Объявления', sub: 'Важные новости от школы' },
]

export default function SettingsNotifications() {
  // UI-only — not persisted anywhere yet.
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ lessons: true, results: true, announcements: true })

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-[#1B4FD8]" />
        <h2 className="text-sm font-bold text-[#191B23]">Уведомления</h2>
      </div>
      <div className="mt-3 space-y-3">
        {TOGGLES.map(t => (
          <div key={t.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#191B23]">{t.label}</div>
              <div className="text-xs text-gray-400">{t.sub}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled[t.key]}
              onClick={() => setEnabled(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled[t.key] ? 'bg-[#1B4FD8]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled[t.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
