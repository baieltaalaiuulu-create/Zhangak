'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Pencil, Sparkles, Loader2 } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  fetchAllChallenges, fetchChallengeStatsMap, fetchOnlineStudentCount, todayStr,
  type DailyChallenge, type ChallengeStats,
} from '@/lib/daily-challenge-data'

const STATUS_META: Record<DailyChallenge['status'], { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-100 text-gray-500' },
  scheduled: { label: 'Запланирован', className: 'bg-amber-50 text-amber-600' },
  published: { label: 'Опубликован', className: 'bg-green-50 text-green-600' },
  completed: { label: 'Завершён', className: 'bg-gray-100 text-gray-500' },
}

function dateLabel(dateStr: string): string {
  const today = todayStr()
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Сегодня'
  if (dateStr === tomorrow) return 'Завтра'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface AutopilotSettings {
  enabled: boolean
  questionCount: number
  xpReward: number
  publishTime: string
}

const DEFAULT_AUTOPILOT: AutopilotSettings = { enabled: false, questionCount: 17, xpReward: 80, publishTime: '00:00' }

export default function AdminDailyChallengePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [challenges, setChallenges] = useState<DailyChallenge[]>([])
  const [statsMap, setStatsMap] = useState<Map<string, ChallengeStats>>(new Map())
  const [totalStudents, setTotalStudents] = useState(0)
  const [autopilot, setAutopilot] = useState<AutopilotSettings>(DEFAULT_AUTOPILOT)
  const [savingAutopilot, setSavingAutopilot] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(todayStr())
  const [showCreate, setShowCreate] = useState(false)
  const [editingRules, setEditingRules] = useState(false)
  const [rulesDraft, setRulesDraft] = useState(DEFAULT_AUTOPILOT)
  const [savingRules, setSavingRules] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const [list, students, settingsRes] = await Promise.all([
      fetchAllChallenges(),
      fetchOnlineStudentCount(),
      fetch('/api/admin/settings').then(r => r.json()).catch(() => ({ settings: {} })),
    ])
    setChallenges(list)
    setTotalStudents(students)
    setStatsMap(await fetchChallengeStatsMap(list.map(c => c.id)))

    const settings = settingsRes.settings ?? {}
    if (settings.ai_autopilot !== undefined) {
      let parsedRules: Partial<AutopilotSettings> = {}
      try { parsedRules = settings.daily_challenge_autopilot_rules ? JSON.parse(settings.daily_challenge_autopilot_rules) : {} } catch { /* ignore malformed */ }
      setAutopilot({
        enabled: settings.ai_autopilot === 'true',
        questionCount: parsedRules.questionCount ?? DEFAULT_AUTOPILOT.questionCount,
        xpReward: parsedRules.xpReward ?? DEFAULT_AUTOPILOT.xpReward,
        publishTime: parsedRules.publishTime ?? DEFAULT_AUTOPILOT.publishTime,
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => { await load() }
    init()
  }, [])

  const todayChallenge = challenges.find(c => c.date === todayStr())
  const todayStats = todayChallenge ? statsMap.get(todayChallenge.id) : undefined
  const completedToday = todayStats?.completedCount ?? 0
  const completionPct = totalStudents > 0 ? Math.round((completedToday / totalStudents) * 100) : 0

  const openRulesEditor = () => {
    setRulesDraft(autopilot)
    setEditingRules(true)
  }

  const saveRules = async () => {
    setSavingRules(true)
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'daily_challenge_autopilot_rules',
        value: JSON.stringify({ questionCount: rulesDraft.questionCount, xpReward: rulesDraft.xpReward, publishTime: rulesDraft.publishTime }),
      }),
    })
    setAutopilot(prev => ({ ...prev, questionCount: rulesDraft.questionCount, xpReward: rulesDraft.xpReward, publishTime: rulesDraft.publishTime }))
    setSavingRules(false)
    setEditingRules(false)
  }

  const toggleAutopilot = async () => {
    const next = !autopilot.enabled
    setSavingAutopilot(true)
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ai_autopilot', value: String(next) }),
    })
    setAutopilot(prev => ({ ...prev, enabled: next }))
    setSavingAutopilot(false)
  }

  const handleGenerateNow = async () => {
    setGenerating(true)
    setError(null)
    try {
      const date = todayChallenge ? new Date(Date.now() + 86400_000).toISOString().slice(0, 10) : todayStr()
      const createRes = await fetch('/api/admin/daily-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Задание дня — ${dateLabel(date)}`, date, questionCount: autopilot.questionCount, xpReward: autopilot.xpReward, status: 'draft', autoGenerated: true }),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error ?? 'Не удалось создать задание')

      const genRes = await fetch('/api/admin/daily-challenge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: created.id, count: autopilot.questionCount, difficulty: 'mixed' }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error ?? 'AI не смог сгенерировать вопросы')

      router.push(`/admin/daily-challenge/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setGenerating(false)
    }
  }

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/daily-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), date: newDate, status: 'draft' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Не удалось создать задание')
      router.push(`/admin/daily-challenge/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Daily Challenge" actionLabel="Новое задание" actionIcon={Plus} onAction={() => setShowCreate(true)} />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Сегодня прошли</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">{completedToday}/{totalStudents}</p>
            <p className="mt-1 text-xs text-gray-400">{completionPct}%</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Completion</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">{completionPct}%</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Средний результат</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">{todayStats?.avgPct ?? '—'}{todayStats?.avgPct !== undefined && todayStats?.avgPct !== null ? '%' : ''}</p>
            <p className="mt-1 text-xs text-gray-400">Целевой: 75%</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Среднее время</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">
              {todayStats?.avgTimeSeconds ? `${Math.floor(todayStats.avgTimeSeconds / 60)}:${String(todayStats.avgTimeSeconds % 60).padStart(2, '0')}` : '—'}
            </p>
            <p className="mt-1 text-xs text-gray-400">мин</p>
          </div>
        </div>

        {/* AI Autopilot card */}
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#191B23]">
              <Sparkles size={18} className="text-amber-500" /> AI Autopilot
            </h2>
            <button
              type="button"
              onClick={toggleAutopilot}
              disabled={savingAutopilot}
              className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${autopilot.enabled ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-60`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${autopilot.enabled ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>

          <p className="mt-2 text-sm text-gray-600">
            {autopilot.enabled
              ? 'AI автоматически создаёт ежедневные задания на основе базы знаний и слабых тем учеников.'
              : 'Автопилот выключен — задания нужно создавать вручную.'}
          </p>

          {editingRules ? (
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-white px-3 py-2">
                <label className="text-xs text-gray-400">Количество вопросов</label>
                <input
                  type="number" min={1} max={50}
                  value={rulesDraft.questionCount}
                  onChange={e => setRulesDraft(d => ({ ...d, questionCount: Number(e.target.value) }))}
                  className="mt-0.5 w-full border-none p-0 font-bold text-[#191B23] outline-none"
                />
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <label className="text-xs text-gray-400">XP</label>
                <input
                  type="number" min={1} max={500}
                  value={rulesDraft.xpReward}
                  onChange={e => setRulesDraft(d => ({ ...d, xpReward: Number(e.target.value) }))}
                  className="mt-0.5 w-full border-none p-0 font-bold text-[#191B23] outline-none"
                />
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <label className="text-xs text-gray-400">Время публикации</label>
                <input
                  type="time"
                  value={rulesDraft.publishTime}
                  onChange={e => setRulesDraft(d => ({ ...d, publishTime: e.target.value }))}
                  className="mt-0.5 w-full border-none p-0 font-bold text-[#191B23] outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-gray-400">Количество вопросов</p>
                <p className="font-bold text-[#191B23]">{autopilot.questionCount}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-gray-400">Сложность</p>
                <p className="font-bold text-[#191B23]">Средняя (динамическая)</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-gray-400">XP</p>
                <p className="font-bold text-[#191B23]">{autopilot.xpReward}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-gray-400">Время публикации</p>
                <p className="font-bold text-[#191B23]">{autopilot.publishTime} ежедневно</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-gray-400">Предметы</p>
                <p className="font-bold text-[#191B23]">Все разделы ОРТ</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-gray-400">Распределение тем</p>
                <p className="font-bold text-[#191B23]">Авто (AI балансировка)</p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateNow}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {generating ? 'Генерация...' : 'Сгенерировать сейчас через AI'}
            </button>
            {editingRules ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={saveRules} disabled={savingRules} className="rounded-xl bg-[#1B4FD8] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {savingRules ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setEditingRules(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-700">
                  Отмена
                </button>
              </div>
            ) : (
              <button type="button" onClick={openRulesEditor} className="text-sm font-semibold text-amber-700 hover:underline">
                Редактировать правила генерации
              </button>
            )}
          </div>
        </div>

        {/* Challenges table */}
        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400">
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Вопросов</th>
                  <th className="px-4 py-3">Прошли</th>
                  <th className="px-4 py-3">Ср. результат</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {challenges.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Заданий пока нет</td></tr>
                ) : challenges.map(c => {
                  const stats = statsMap.get(c.id)
                  const status = STATUS_META[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-[#191B23]">{dateLabel(c.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{c.question_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{stats?.completedCount ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{stats?.avgPct != null ? `${stats.avgPct}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/daily-challenge/${c.id}?preview=1`} aria-label="Предпросмотр" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                            <Eye size={16} />
                          </Link>
                          <Link href={`/admin/daily-challenge/${c.id}`} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                            <Pencil size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#191B23]">Новое задание дня</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Название</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Задание дня — 10 декабря"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Дата</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
