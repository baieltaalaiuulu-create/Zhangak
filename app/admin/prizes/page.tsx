'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { supabase } from '@/lib/supabase'
import { currentWeekStart } from '@/lib/daily-challenge-data'
import { fetchPrizesForWeek, fetchPrizeHistory, type WeeklyPrize, type PrizeHistoryRow } from '@/lib/weekly-leaderboard-data'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

interface PrizeDraft {
  place: 1 | 2 | 3
  title: string
  description: string
  imageUrl: string | null
}

const PLACE_META: Record<1 | 2 | 3, { label: string; color: string }> = {
  1: { label: '🥇 1 место', color: '#F5B800' },
  2: { label: '🥈 2 место', color: '#9CA3AF' },
  3: { label: '🥉 3 место', color: '#C97A3D' },
}

const STATUS_LABELS: Record<WeeklyPrize['status'], string> = { active: 'Активен', sent: 'Отправлено', claimed: 'Зачислено' }

function emptyDraft(place: 1 | 2 | 3): PrizeDraft {
  return { place, title: '', description: '', imageUrl: null }
}

export default function AdminPrizesPage() {
  const weekStart = currentWeekStart()
  const weekEnd = new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 86400_000).toISOString().slice(0, 10)

  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<1 | 2 | 3, PrizeDraft>>({ 1: emptyDraft(1), 2: emptyDraft(2), 3: emptyDraft(3) })
  const [uploading, setUploading] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<PrizeHistoryRow[]>([])
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    const load = async () => {
      const [prizes, historyRows] = await Promise.all([fetchPrizesForWeek(weekStart), fetchPrizeHistory()])
      setDrafts(prev => {
        const next = { ...prev }
        for (const p of prizes) {
          next[p.place] = { place: p.place, title: p.title, description: p.description ?? '', imageUrl: p.image_url }
        }
        return next
      })
      setHistory(historyRows)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleImageUpload = async (place: 1 | 2 | 3, file: File) => {
    setUploading(place)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${weekStart}/${place}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('prize-images').upload(path, file, { upsert: true })
      if (error) return
      const { data } = supabase.storage.from('prize-images').getPublicUrl(path)
      setDrafts(prev => ({ ...prev, [place]: { ...prev[place], imageUrl: data.publicUrl } }))
    } finally {
      setUploading(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await authenticatedFetch('/api/admin/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          prizes: ([1, 2, 3] as const).map(p => ({
            place: p, title: drafts[p].title, description: drafts[p].description || null, imageUrl: drafts[p].imageUrl,
          })),
        }),
      })
      if (res.ok) {
        setSaved(true)
        setHistory(await fetchPrizeHistory())
        window.setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Рейтинг и призы" />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-500">
            {new Date(`${weekStart}T00:00:00`).toLocaleDateString('ru', { day: '2-digit', month: 'short' })} — {new Date(`${weekEnd}T00:00:00`).toLocaleDateString('ru', { day: '2-digit', month: 'short' })}
          </p>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">Период рейтинга: Неделя</span>
        </div>

        <div>
          <h2 className="text-base font-bold text-[#191B23]">Распределение еженедельных наград</h2>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">Загрузка...</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {([2, 1, 3] as const).map(place => {
                const meta = PLACE_META[place]
                const d = drafts[place]
                const highlighted = place === 1
                return (
                  <div
                    key={place}
                    className={`flex flex-col rounded-2xl border bg-white p-5 ${highlighted ? 'border-2 border-amber-300 shadow-md sm:-mt-3 sm:pb-8' : 'border-gray-200'}`}
                  >
                    <span className="text-sm font-extrabold" style={{ color: meta.color }}>{meta.label}</span>

                    <button
                      type="button"
                      onClick={() => fileInputs.current[place]?.click()}
                      disabled={uploading === place}
                      className="mt-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
                    >
                      {uploading === place ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : d.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                          <Camera size={18} /> Загрузить фото
                        </span>
                      )}
                    </button>
                    <input
                      ref={el => { fileInputs.current[place] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(place, f); e.target.value = '' }}
                    />

                    <input
                      value={d.title}
                      onChange={e => setDrafts(prev => ({ ...prev, [place]: { ...prev[place], title: e.target.value } }))}
                      placeholder="Название приза"
                      className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                    />
                    <textarea
                      value={d.description}
                      onChange={e => setDrafts(prev => ({ ...prev, [place]: { ...prev[place], description: e.target.value } }))}
                      placeholder="Описание"
                      rows={2}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                    />
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Сохранение...' : 'Сохранить призы'}
            </button>
            {saved && <span className="text-sm font-semibold text-green-600">✓ Сохранено</span>}
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-[#191B23]">История выданных призов</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400">
                  <th className="px-4 py-3">Период</th>
                  <th className="px-4 py-3">Приз</th>
                  <th className="px-4 py-3">Победитель</th>
                  <th className="px-4 py-3">XP победителя</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">История пуста</td></tr>
                ) : history.map((h, i) => (
                  <tr key={`${h.weekStart}-${h.place}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(`${h.weekStart}T00:00:00`).toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#191B23]">{PLACE_META[h.place].label.replace(/^[^ ]+ /, '')} — {h.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{h.winnerName ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{h.winnerXp ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${h.status === 'claimed' ? 'bg-green-50 text-green-600' : h.status === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[h.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
