'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, BookOpen, PenLine, ClipboardCheck } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { fetchAnalyticsData, type AnalyticsData } from '@/lib/admin-data'

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const d = await fetchAnalyticsData()
      setData(d)
      setLoading(false)
    }
    init()
  }, [])

  const stats = data?.stats
  const chartData = (data?.dailyCounts ?? []).map(d => ({ ...d, label: formatDay(d.date) }))
  const sectionMax = Math.max(...(data?.sectionAverages ?? []).map(s => s.average), 1)

  const statCards = [
    { label: 'Ученики', value: stats?.totalStudents ?? 0, icon: Users, color: '#1B4FD8' },
    { label: 'Уроки', value: stats?.totalLessons ?? 0, icon: BookOpen, color: '#7C3AED' },
    { label: 'Вопросы', value: stats?.totalQuestions ?? 0, icon: PenLine, color: '#F59E0B' },
    { label: 'Тестов пройдено', value: stats?.testsCompleted ?? 0, icon: ClipboardCheck, color: '#10B981' },
  ]

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Аналитика" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-extrabold" style={{ color: c.color }}>{loading ? '—' : c.value}</div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${c.color}1A` }}>
                    <Icon size={16} style={{ color: c.color }} />
                  </div>
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-500">{c.label}</div>
              </div>
            )
          })}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold text-[#191B23]">Тесты по дням (30 дней)</h2>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">Загрузка...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} interval={4} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                    labelStyle={{ fontWeight: 700, color: '#191B23' }}
                    formatter={value => [`${value}`, 'Тестов']}
                  />
                  <Bar dataKey="count" fill="#1B4FD8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">Топ-10 учеников</div>
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Загрузка...</div>
            ) : (data?.topStudents.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Пока нет результатов</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data!.topStudents.map((s, i) => (
                  <div key={s.studentId} className="flex items-center gap-3 px-4 py-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-[#1B4FD8] text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold text-[#191B23]">{s.fullName}</span>
                    <span className="text-sm font-bold text-[#1B4FD8]">{Math.round(s.bestScore)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">Средний балл по разделам</div>
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Загрузка...</div>
            ) : (
              <div className="space-y-3 p-4">
                {data!.sectionAverages.map(s => (
                  <div key={s.section}>
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                      <span>{s.label}</span>
                      <span className="text-[#191B23]">{s.average}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-[#1B4FD8]" style={{ width: `${(s.average / sectionMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
