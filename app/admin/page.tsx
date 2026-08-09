'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, UserCheck, BookOpen, ClipboardCheck, Plus, FileQuestion, Download,
  TrendingUp, TrendingDown, Minus, Trophy, PenLine,
} from 'lucide-react'
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

function todayLabel(): string {
  const label = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function Trend({ delta, suffix }: { delta: number; suffix: string }) {
  if (delta === 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400"><Minus size={12} /> без изменений</span>
  }
  const up = delta > 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {up ? '+' : ''}{delta} {suffix}
    </span>
  )
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
    {
      label: 'Всего учеников', value: stats.totalStudents, icon: Users, color: '#1B4FD8', bg: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
      trend: <Trend delta={stats.newStudentsThisWeek} suffix="за неделю" />,
    },
    {
      label: 'Активны сегодня', value: stats.activeToday, icon: UserCheck, color: '#10B981', bg: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
      trend: <Trend delta={stats.activeToday - stats.activeYesterday} suffix="к вчера" />,
    },
    {
      label: 'Уроков загружено', value: stats.lessonsLoaded, icon: BookOpen, color: '#7C3AED', bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
      trend: <Trend delta={stats.newLessonsThisWeek} suffix="за неделю" />,
    },
    {
      label: 'Тестов пройдено', value: stats.testsCompleted, icon: ClipboardCheck, color: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
      trend: <Trend delta={stats.testsCompletedToday} suffix="сегодня" />,
    },
  ] : []

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Dashboard" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div>
          <h1 className="text-lg font-bold text-[#191B23]">Сегодня</h1>
          <p className="text-sm text-gray-400">{todayLabel()}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 h-32 animate-pulse" />
            ))
          ) : cards.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                  <Icon size={20} color={c.color} />
                </div>
                <div className="mt-4 text-2xl font-extrabold text-[#191B23]">{c.value}</div>
                <div className="mt-1 text-sm text-gray-500">{c.label}</div>
                <div className="mt-2">{c.trend}</div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <button onClick={() => router.push('/admin/lessons/new')}
            className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1B4FD8]/30 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #1B4FD8 0%, #3B82F6 100%)' }}>
              <Plus size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-[#191B23]">Добавить урок</div>
              <div className="text-xs text-gray-400">Новый урок практики</div>
            </div>
          </button>
          <button onClick={() => router.push('/admin/lessons')}
            className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#7C3AED]/30 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <FileQuestion size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-[#191B23]">Добавить вопросы</div>
              <div className="text-xs text-gray-400">Выбрать урок и наполнить</div>
            </div>
          </button>
          <button onClick={exportStats}
            className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#10B981]/30 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)' }}>
              <Download size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-[#191B23]">Экспорт статистики</div>
              <div className="text-xs text-gray-400">Скачать CSV</div>
            </div>
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
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
                    {item.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, no next/image domain config
                      <img src={item.avatarUrl} alt={item.studentName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white">
                        {item.studentName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#191B23]">{item.studentName}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          item.type === 'mock' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {item.type === 'mock' ? <Trophy size={9} /> : <PenLine size={9} />}
                          {item.type === 'mock' ? 'Пробный ОРТ' : 'Тренажёр'}
                        </span>
                        <span className="truncate text-xs text-gray-400">{item.testTitle}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      item.score >= 180 ? 'bg-green-50 text-green-600' : item.score >= 100 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.score}
                    </span>
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
