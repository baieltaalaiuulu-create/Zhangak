'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { Users, BookOpen, PenLine, ClipboardCheck, Trophy, CheckCircle2, Sparkles, RefreshCw, Eye, AlertTriangle } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  fetchCompanyAnalytics, fetchAnalyticsInsights,
  type CompanyAnalytics,
} from '@/lib/company-analytics-data'

function formatMonth(period: string): string {
  const [y, m] = period.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
}

export default function AdminAnalyticsPage() {
  const [year, setYear] = useState<string | null>(null)
  const [data, setData] = useState<CompanyAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const [insights, setInsights] = useState<string[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const d = await fetchCompanyAnalytics(year)
      setData(d)
      setLoading(false)
    }
    load()
  }, [year])

  const loadInsights = async () => {
    if (!data) return
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const result = await fetchAnalyticsInsights({ ...data.stats, period: year ?? 'Все годы', growth: data.growth, scoreDistribution: data.scoreDistribution })
      setInsights(result)
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : 'Не удалось получить инсайты')
    } finally {
      setInsightsLoading(false)
    }
  }

  const stats = data?.stats
  const statCards = [
    { label: 'Ученики', value: stats?.totalStudents ?? 0, icon: Users, color: '#1B4FD8' },
    { label: 'Уроки', value: stats?.totalLessons ?? 0, icon: BookOpen, color: '#7C3AED' },
    { label: 'Вопросы', value: stats?.totalQuestions ?? 0, icon: PenLine, color: '#F59E0B' },
    { label: 'Тестов пройдено', value: stats?.testsCompleted ?? 0, icon: ClipboardCheck, color: '#10B981' },
    { label: 'Средний балл', value: stats?.avgScore ?? 0, icon: Trophy, color: '#EC4899' },
    { label: 'Поступили', value: `${stats?.admittedRate ?? 0}%`, icon: CheckCircle2, color: '#06B6D4' },
  ]

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Аналитика" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setYear(null)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${year === null ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            Все годы
          </button>
          {(data?.years ?? []).map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${year === y ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              {y}
            </button>
          ))}
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-bold text-[#191B23]">Рост учеников по годам</h2>
            <div className="mt-4 h-56">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">Загрузка...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.growth ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={value => [`${value}`, 'Учеников']} />
                    <Bar dataKey="count" fill="#1B4FD8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-bold text-[#191B23]">Распределение баллов</h2>
            <div className="mt-4 h-56">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">Загрузка...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.scoreDistribution ?? []} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="bucket" type="category" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={value => [`${value}`, 'Учеников']} />
                    <Bar dataKey="count" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1B4FD8]/20 bg-gradient-to-br from-[#EEF2FF] to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
              <Sparkles size={16} className="text-[#1B4FD8]" /> AI Инсайты
            </div>
            <button onClick={loadInsights} disabled={insightsLoading || loading}
              className="flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              <RefreshCw size={14} className={insightsLoading ? 'animate-spin' : ''} />
              {insights ? 'Обновить' : 'Получить инсайты'}
            </button>
          </div>

          {insightsError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{insightsError}</div>}

          {insights && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((text, i) => (
                <div key={i} className="animate-ai-fade-in flex gap-2.5 rounded-xl bg-white p-4 shadow-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white">{i + 1}</span>
                  <p className="text-sm leading-relaxed text-gray-600">{text}</p>
                </div>
              ))}
            </div>
          )}

          {!insights && !insightsLoading && (
            <p className="mt-3 text-sm text-gray-500">AI проанализирует статистику компании и даст 4 ключевых инсайта.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold text-[#191B23]">Средний балл по месяцам</h2>
          <div className="mt-4 h-56">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">Загрузка...</div>
            ) : (data?.scoreProgression.length ?? 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">Недостаточно данных</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.scoreProgression.map(p => ({ ...p, label: formatMonth(p.period) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 245]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={value => [`${value}`, 'Средний балл']} />
                  <Line type="monotone" dataKey="avgScore" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">Популярные уроки</div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Загрузка...</div>
          ) : (data?.popularLessons.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Пока нет данных</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Урок</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Просмотры</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Ошибок</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.popularLessons.map(l => (
                    <tr key={l.lessonId} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 font-semibold text-[#191B23]">{l.title}</td>
                      <td className="px-4 py-3 text-gray-500"><span className="inline-flex items-center gap-1"><Eye size={13} className="text-gray-400" /> {l.views}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 font-semibold ${l.errorRate >= 40 ? 'text-red-500' : l.errorRate >= 20 ? 'text-amber-600' : 'text-green-600'}`}>
                          {l.errorRate >= 40 && <AlertTriangle size={13} />} {l.errorRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
