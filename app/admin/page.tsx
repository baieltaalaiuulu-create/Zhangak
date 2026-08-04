'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserCheck, BookOpen, ClipboardCheck, Plus, FileQuestion, Download } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { fetchDashboardStats, fetchRecentActivity, type DashboardStats, type ActivityItem } from '@/lib/admin-data'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} дн назад`
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const [s, a] = await Promise.all([fetchDashboardStats(), fetchRecentActivity()])
      setStats(s)
      setActivity(a)
      setLoading(false)
    }
    load()
  }, [])

  const exportStats = () => {
    if (!stats) return
    const rows = [
      ['Метрика', 'Значение'],
      ['Всего учеников', String(stats.totalStudents)],
      ['Активны сегодня', String(stats.activeToday)],
      ['Уроков загружено', String(stats.lessonsLoaded)],
      ['Тестов пройдено', String(stats.testsCompleted)],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zhangak-stats-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cards = stats ? [
    { label: 'Всего учеников', value: stats.totalStudents, icon: Users, color: '#1B4FD8', bg: '#EEF2FF' },
    { label: 'Активны сегодня', value: stats.activeToday, icon: UserCheck, color: '#10B981', bg: '#F0FDF4' },
    { label: 'Уроков загружено', value: stats.lessonsLoaded, icon: BookOpen, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Тестов пройдено', value: stats.testsCompleted, icon: ClipboardCheck, color: '#F59E0B', bg: '#FFFBEB' },
  ] : []

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Dashboard" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 h-28 animate-pulse" />
            ))
          ) : cards.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: c.bg }}>
                  <Icon size={20} color={c.color} />
                </div>
                <div className="mt-4 text-2xl font-extrabold text-[#191B23]">{c.value}</div>
                <div className="mt-1 text-sm text-gray-500">{c.label}</div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <button onClick={() => router.push('/admin/lessons/new')}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF2FF]"><Plus size={18} className="text-[#1B4FD8]" /></div>
            <div>
              <div className="text-sm font-bold text-[#191B23]">Добавить урок</div>
              <div className="text-xs text-gray-400">Новый урок практики</div>
            </div>
          </button>
          <button onClick={() => router.push('/admin/lessons')}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F5F3FF]"><FileQuestion size={18} className="text-[#7C3AED]" /></div>
            <div>
              <div className="text-sm font-bold text-[#191B23]">Добавить вопросы</div>
              <div className="text-xs text-gray-400">Выбрать урок и наполнить</div>
            </div>
          </button>
          <button onClick={exportStats}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDF4]"><Download size={18} className="text-[#10B981]" /></div>
            <div>
              <div className="text-sm font-bold text-[#191B23]">Экспорт статистики</div>
              <div className="text-xs text-gray-400">Скачать CSV</div>
            </div>
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4 text-sm font-bold text-[#191B23]">Последняя активность</div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Загрузка...</div>
          ) : activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Активности пока нет</div>
          ) : (
            <div>
              {activity.map((item, i) => (
                <div key={item.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${i < activity.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white">
                      {item.studentName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#191B23]">{item.studentName}</div>
                      <div className="truncate text-xs text-gray-400">{item.testTitle}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-bold text-[#1B4FD8]">{item.score}</span>
                    <span className="hidden text-xs text-gray-400 sm:inline">{timeAgo(item.completedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
