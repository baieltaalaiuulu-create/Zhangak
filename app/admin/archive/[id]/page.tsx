'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import {
  ArrowLeft, Printer, User, Wallet, TrendingUp, BookOpen, PenLine, ClipboardList, Layers, Award,
  Sparkles, Clock, Flame, Target, GraduationCap, Zap, Check, Circle, type LucideIcon,
} from 'lucide-react'
import {
  fetchStudentDossier, type StudentDossier, type AchievementKey,
} from '@/lib/archive-data'
import { fetchStudentContext, streamMentorMessage, type MentorResponse } from '@/lib/ai-mentor-data'
import AIMessageCard from '@/components/student/ai/AIMessageCard'
import AITypingIndicator from '@/components/student/ai/AITypingIndicator'

type Tab = 'general' | 'finance' | 'progress' | 'learning' | 'practice' | 'mock' | 'subjects' | 'achievements' | 'ai' | 'timeline'

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'general', label: 'Общее', icon: User },
  { key: 'finance', label: 'Финансы', icon: Wallet },
  { key: 'progress', label: 'Прогресс', icon: TrendingUp },
  { key: 'learning', label: 'Обучение', icon: BookOpen },
  { key: 'practice', label: 'Практика', icon: PenLine },
  { key: 'mock', label: 'Пробные ОРТ', icon: ClipboardList },
  { key: 'subjects', label: 'Предметы', icon: Layers },
  { key: 'achievements', label: 'Достижения', icon: Award },
  { key: 'ai', label: 'AI Анализ', icon: Sparkles },
  { key: 'timeline', label: 'Таймлайн', icon: Clock },
]

const PAYMENT_STATUS_LABELS: Record<string, string> = { paid: 'Оплачено', partial: 'Частично', debt: 'Долг' }

const ACHIEVEMENT_META: Record<AchievementKey, { label: string; icon: LucideIcon }> = {
  first_lesson: { label: 'Первый урок', icon: BookOpen },
  hundred_questions: { label: '100 вопросов', icon: PenLine },
  week_streak: { label: 'Серия 7 дней', icon: Flame },
  first_mock: { label: 'Первый пробный ОРТ', icon: ClipboardList },
  target_reached: { label: 'Цель достигнута', icon: Target },
  course_completed: { label: 'Курс завершён', icon: GraduationCap },
  active_learner: { label: 'Активный ученик', icon: Zap },
}

function StatCard({ label, value, color = '#1B4FD8' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="mt-1 text-xs font-semibold text-gray-500">{label}</div>
    </div>
  )
}

function heatmapColor(count: number): string {
  if (count === 0) return '#F0F1F5'
  if (count === 1) return '#BFDBFE'
  if (count <= 3) return '#60A5FA'
  return '#1B4FD8'
}

export default function ArchiveStudentDossierPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [dossier, setDossier] = useState<StudentDossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('general')

  const [aiResult, setAiResult] = useState<MentorResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const d = await fetchStudentDossier(params.id)
      if (!d) { router.push('/admin/archive'); return }
      setDossier(d)
      setLoading(false)
    }
    init()
  }, [params.id, router])

  const runAiAnalysis = async () => {
    if (!dossier) return
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    try {
      const ctx = await fetchStudentContext(dossier.profile.id)
      await streamMentorMessage(
        `Проведи полный анализ успеваемости ученика ${dossier.profile.full_name} за весь период обучения и дай рекомендации на будущее.`,
        ctx,
        [],
        { page: 'profile', contextData: { archived: dossier.profile.archived } },
        'analysis',
        update => setAiResult({ type: update.type, title: update.title, content: update.content, actions: update.actions }),
      )
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Не удалось получить анализ')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading || !dossier) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
      <div className="text-sm text-gray-400">Загрузка...</div>
    </div>
  )

  const { profile } = dossier
  const heatmapWeeks: typeof dossier.heatmap[number][][] = []
  for (let i = 0; i < dossier.heatmap.length; i += 7) heatmapWeeks.push(dossier.heatmap.slice(i, i + 7))

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button onClick={() => router.push('/admin/archive')} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#1B4FD8]">
            <ArrowLeft size={15} /> Назад в архив
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <Printer size={15} /> Экспорт в PDF
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1B4FD8] text-lg font-bold text-white">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
              <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
            ) : profile.full_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#191B23]">{profile.full_name}</h1>
            <p className="text-sm text-gray-400">{profile.email ?? profile.phone ?? '—'}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${profile.archived ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>
            {profile.archived ? 'В архиве' : 'Активен'}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${profile.finalScore === null ? 'bg-gray-100 text-gray-500' : profile.admitted ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {profile.finalScore === null ? 'Без результата' : profile.admitted ? 'Поступил' : 'Не поступил'}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'general' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Телефон" value={profile.phone ?? '—'} />
            <StatCard label="Email" value={profile.email ?? '—'} />
            <StatCard label="Дата регистрации" value={new Date(profile.createdAt).toLocaleDateString('ru')} />
            <StatCard label="Последняя активность" value={profile.lastActivityAt ? new Date(profile.lastActivityAt).toLocaleDateString('ru') : '—'} />
            <StatCard label="Длительность обучения" value={`${profile.durationDays} дн.`} />
            <StatCard label="Общее время обучения" value={`≈ ${dossier.studyHours} ч.`} />
            <StatCard label="Целевой балл" value={profile.targetScore} />
            <StatCard label="Итоговый балл" value={profile.finalScore ?? '—'} color={profile.admitted ? '#10B981' : '#191B23'} />
          </div>
        )}

        {tab === 'finance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Оплачено всего" value={`${dossier.paidTotal.toLocaleString()} сом`} color="#10B981" />
              <StatCard label="Платежей" value={dossier.payments.length} />
              <StatCard label="Стоимость курса" value="не отслеживается" />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">История платежей</div>
              {dossier.payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Платежей нет</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dossier.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-[#191B23]">{p.amount.toLocaleString()} сом</div>
                        <div className="text-xs text-gray-400">{p.note || p.month}</div>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</span>
                        <div className="mt-1 text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('ru')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'progress' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Первый балл" value={dossier.progressStats.first} />
              <StatCard label="Лучший балл" value={dossier.progressStats.best} color="#10B981" />
              <StatCard label="Последний балл" value={dossier.progressStats.latest} />
              <StatCard label="Средний балл" value={dossier.progressStats.avg} />
              <StatCard label="Цель" value={dossier.progressStats.target} />
              <StatCard label="Прирост" value={dossier.progressStats.gain >= 0 ? `+${dossier.progressStats.gain}` : dossier.progressStats.gain} color={dossier.progressStats.gain >= 0 ? '#10B981' : '#EF4444'} />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-bold text-[#191B23]">Динамика балла</h2>
              <div className="mt-4 h-64">
                {dossier.scoreHistory.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">Нет результатов пробных ОРТ</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dossier.scoreHistory.map(p => ({ label: new Date(p.completedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), score: p.score }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 245]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={value => [`${value}`, 'Балл']} />
                      <ReferenceLine y={profile.targetScore} stroke="#10B981" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="score" stroke="#1B4FD8" strokeWidth={2.5} dot={{ r: 4, fill: '#1B4FD8' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'learning' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Уроков просмотрено" value={profile.lessonsCount} />
              <StatCard label="Часов обучения" value={`≈ ${dossier.studyHours} ч.`} />
              <StatCard label="Текущая серия" value={`${dossier.streak} дн.`} />
              <StatCard label="Лучшая серия" value={`${dossier.bestStreak} дн.`} color="#10B981" />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-bold text-[#191B23]">Активность за 12 недель</h2>
              <div className="mt-4 flex gap-1 overflow-x-auto">
                {heatmapWeeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map(day => (
                      <div key={day.date} title={`${day.date}: ${day.count}`} className="h-3 w-3 rounded-sm" style={{ background: heatmapColor(day.count) }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'practice' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Всего решено" value={dossier.practiceStats.totalSolved} />
              <StatCard label="Правильно" value={`${dossier.practiceStats.correctPct}%`} color="#10B981" />
              <StatCard label="Неправильно" value={`${100 - dossier.practiceStats.correctPct}%`} color="#EF4444" />
              <StatCard label="Среднее время" value="не отслеживается" />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-[#191B23]">Сложные темы</div>
              {dossier.practiceStats.hardTopics.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Недостаточно данных</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dossier.practiceStats.hardTopics.map(t => (
                    <div key={t.section} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-semibold text-[#191B23]">{t.label}</span>
                      <span className="text-xs font-bold text-red-500">{t.wrongCount} ошибок</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'mock' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-bold text-[#191B23]">Динамика результатов</h2>
              <div className="mt-4 h-56">
                {dossier.mockHistory.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">Пробных ОРТ ещё не было</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...dossier.mockHistory].reverse().map(m => ({ label: new Date(m.completed_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), score: m.total_score }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 245]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
                      <Line type="monotone" dataKey="score" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 4, fill: '#7C3AED' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.mockHistory.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">Нет данных</td></tr>
                  ) : dossier.mockHistory.map(m => (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-gray-500">{new Date(m.completed_at).toLocaleDateString('ru')}</td>
                      <td className="px-4 py-3 font-bold text-[#1B4FD8]">{m.total_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'subjects' && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Раздел</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Начало</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Сейчас</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Уроков</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Практик</th>
                </tr>
              </thead>
              <tbody>
                {dossier.subjects.map(s => (
                  <tr key={s.key} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-[#191B23]">{s.label}</td>
                    <td className="px-4 py-3 text-gray-500">{s.startScore}</td>
                    <td className="px-4 py-3 font-bold text-[#1B4FD8]">{s.endScore}</td>
                    <td className="px-4 py-3 text-gray-500">{s.lessonsCount || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.practiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'achievements' && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {dossier.achievements.map(a => {
              const meta = ACHIEVEMENT_META[a.key]
              const Icon = meta.icon
              return (
                <div key={a.key} className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center ${a.achieved ? 'border-[#1B4FD8]/20 bg-[#EEF2FF]' : 'border-gray-200 bg-white opacity-50'}`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${a.achieved ? 'bg-[#1B4FD8] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-xs font-bold text-[#191B23]">{meta.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-4">
            {!aiResult && !aiLoading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <Sparkles size={22} className="mx-auto mb-2 text-[#1B4FD8]" />
                <p className="text-sm text-gray-500">Запроси у AI Mentor полный анализ успеваемости этого ученика.</p>
                <button onClick={runAiAnalysis} className="mt-4 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700">
                  Провести анализ
                </button>
              </div>
            )}
            {aiLoading && !aiResult && <AITypingIndicator />}
            {aiError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{aiError}</div>}
            {aiResult && (
              <>
                <AIMessageCard response={aiResult} />
                <button onClick={runAiAnalysis} disabled={aiLoading} className="text-sm font-semibold text-[#1B4FD8] hover:underline">
                  Обновить анализ
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <ol className="space-y-5">
              {dossier.timeline.map((e, i) => (
                <li key={e.key} className="relative flex gap-4 pl-1">
                  {i < dossier.timeline.length - 1 && (
                    <span className="absolute left-[13px] top-6 h-full w-0.5 bg-gray-100" />
                  )}
                  <span className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${e.achieved ? 'bg-[#1B4FD8] text-white' : 'bg-gray-100 text-gray-300'}`}>
                    {e.achieved ? <Check size={13} /> : <Circle size={8} className="fill-current" />}
                  </span>
                  <div>
                    <div className={`text-sm font-bold ${e.achieved ? 'text-[#191B23]' : 'text-gray-400'}`}>{e.label}</div>
                    <div className="text-xs text-gray-400">{e.date ? new Date(e.date).toLocaleDateString('ru') : 'Ещё не достигнуто'}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
