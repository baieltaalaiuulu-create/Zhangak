'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Search, Users, Trophy, Award, CheckCircle2, BookOpen, PenLine } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  fetchArchiveStudents, computeArchiveStats, exportArchiveToCsv,
  type ArchiveStudent,
} from '@/lib/archive-data'

type ActivityTab = 'active' | 'archived'
type ScoreFilter = '' | '180' | '200' | '220'
type StatusFilter = '' | 'admitted' | 'not_admitted'

export default function AdminArchivePage() {
  const router = useRouter()
  const [students, setStudents] = useState<ArchiveStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ActivityTab>('archived')
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')

  useEffect(() => {
    const init = async () => {
      const data = await fetchArchiveStudents()
      setStudents(data)
      setLoading(false)
    }
    init()
  }, [])

  const years = useMemo(() => Array.from(new Set(students.map(s => s.registrationYear))).sort((a, b) => b - a), [students])

  const byTab = useMemo(() => students.filter(s => tab === 'archived' ? s.archived : !s.archived), [students, tab])

  const filtered = useMemo(() => byTab.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      const matches = s.full_name.toLowerCase().includes(q) || (s.phone ?? '').includes(q) || s.id.toLowerCase().includes(q)
      if (!matches) return false
    }
    if (yearFilter && String(s.registrationYear) !== yearFilter) return false
    if (scoreFilter && (s.finalScore ?? 0) < Number(scoreFilter)) return false
    if (statusFilter === 'admitted' && !s.admitted) return false
    if (statusFilter === 'not_admitted' && (s.admitted || s.finalScore === null)) return false
    return true
  }), [byTab, search, yearFilter, scoreFilter, statusFilter])

  const stats = useMemo(() => computeArchiveStats(students), [students])

  const statCards = [
    { label: 'Всего в архиве', value: stats.totalArchived, icon: Users, color: '#1B4FD8' },
    { label: 'Средний итоговый балл', value: stats.avgFinalScore, icon: Trophy, color: '#7C3AED' },
    { label: 'Лучший балл', value: stats.bestScore, icon: Award, color: '#F59E0B' },
    { label: 'Поступили', value: `${stats.completionRate}%`, icon: CheckCircle2, color: '#10B981' },
    { label: 'Уроков просмотрено', value: stats.totalLessonsWatched, icon: BookOpen, color: '#EC4899' },
    { label: 'Вопросов решено', value: stats.totalQuestionsSolved, icon: PenLine, color: '#06B6D4' },
  ]

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="📦 Архив" actionLabel="Экспорт в Excel" actionIcon={Download} onAction={() => exportArchiveToCsv(filtered)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xl font-extrabold" style={{ color: c.color }}>{loading ? '—' : c.value}</div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${c.color}1A` }}>
                    <Icon size={14} style={{ color: c.color }} />
                  </div>
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-tight text-gray-500">{c.label}</div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          {([['archived', 'Архив'], ['active', 'Активные']] as [ActivityTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tab === key ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск: имя, телефон, ID"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Все годы</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value as ScoreFilter)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Любой балл</option>
            <option value="180">180+</option>
            <option value="200">200+</option>
            <option value="220">220+</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Все статусы</option>
            <option value="admitted">Поступил</option>
            <option value="not_admitted">Не поступил</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Ученик</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">ID</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Регистрация</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Окончание</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Длит.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Балл</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Прогресс</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Уроки</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Тесты</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Активность</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Статус</th>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Загрузка...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Ученики не найдены</td></tr>
              ) : filtered.map((s, i) => {
                const scoreColor = s.finalScore === null ? '#9CA3AF' : s.admitted ? '#10B981' : s.finalScore >= 150 ? '#F59E0B' : '#EF4444'
                return (
                  <tr key={s.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1B4FD8] text-xs font-bold text-white">
                          {s.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                            <img src={s.avatar_url} alt={s.full_name} className="h-full w-full object-cover" />
                          ) : s.full_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#191B23]">{s.full_name}</div>
                          <div className="truncate text-xs text-gray-400">{s.email ?? s.phone ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">{s.id.slice(0, 8)}</td>
                    <td className="px-3 py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString('ru')}</td>
                    <td className="px-3 py-3 text-gray-500">{s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleDateString('ru') : '—'}</td>
                    <td className="px-3 py-3 text-gray-500">{s.durationDays} дн.</td>
                    <td className="px-3 py-3 font-bold" style={{ color: scoreColor }}>{s.finalScore ?? '—'}</td>
                    <td className="px-3 py-3">
                      <div className="h-1.5 w-20 rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-[#1B4FD8]" style={{ width: `${s.progressPct}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{s.lessonsCount}</td>
                    <td className="px-3 py-3 text-gray-500">{s.testsCount}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.archived ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>
                        {s.archived ? 'В архиве' : 'Активен'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.finalScore === null ? 'bg-gray-100 text-gray-500' : s.admitted ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {s.finalScore === null ? '—' : s.admitted ? 'Поступил' : 'Не поступил'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => router.push(`/admin/archive/${s.id}`)} className="text-sm font-bold text-[#1B4FD8] hover:underline">
                        Открыть →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
