'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Brain, Target, TrendingUp, Clock, ClipboardList, PenLine, Sparkles,
  LayoutGrid, MessageCircle, BarChart2, ListChecks, Send, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore, fetchScoreHistory, type ScorePoint } from '@/lib/profile-data'
import { fetchWeakSections, fetchRecentActivity, projectScore, recommendedPracticeCount, type WeakSection, type RecentActivityItem } from '@/lib/ai-coach-data'
import {
  fetchStudentContext, sendMentorMessage,
  getStoredPlan, storePlan, getCheckedPlanItems, togglePlanItem,
  type StudentContext, type ChatMessage, type MentorResponse,
} from '@/lib/ai-mentor-data'
import AIHeroCard from '@/components/student/ai/AIHeroCard'
import AIQuickActions from '@/components/student/ai/AIQuickActions'
import AIMessageCard from '@/components/student/ai/AIMessageCard'
import AITypingIndicator from '@/components/student/ai/AITypingIndicator'
import AIAnalytics from '@/components/student/ai/AIAnalytics'

type Tab = 'home' | 'chat' | 'analytics' | 'plan'

const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'home', label: 'Главная', icon: LayoutGrid },
  { key: 'chat', label: 'Чат', icon: MessageCircle },
  { key: 'analytics', label: 'Аналитика', icon: BarChart2 },
  { key: 'plan', label: 'Мой план', icon: ListChecks },
]

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )
}

let idCounter = 0
function nextId(): string { idCounter += 1; return `m${idCounter}` }

export default function AiMentorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('home')

  const [studentContext, setStudentContext] = useState<StudentContext | null>(null)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [weakSections, setWeakSections] = useState<WeakSection[]>([])
  const [activity, setActivity] = useState<RecentActivityItem[]>([])
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([])

  // Shared conversation — Главная's quick actions / hero button and the
  // Чат tab all feed the same thread, so switching tabs keeps context.
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // "Мой план" — generated on demand, cached per-day in localStorage.
  const [plan, setPlan] = useState<MentorResponse | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [generatingPlan, setGeneratingPlan] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type, target_score')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setTargetScore(profile.target_score ?? DEFAULT_TARGET_SCORE)

      const [score, weak, recent, history, ctx] = await Promise.all([
        fetchLatestMockScore(user.id),
        fetchWeakSections(user.id),
        fetchRecentActivity(user.id),
        fetchScoreHistory(user.id, 10),
        fetchStudentContext(user.id),
      ])
      setLatestScore(score)
      setWeakSections(weak)
      setActivity(recent)
      setScoreHistory(history)
      setStudentContext(ctx)
      setPlan(getStoredPlan())
      setCheckedItems(getCheckedPlanItems())
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, tab])

  const pushMessage = (msg: ChatMessage) => setMessages(prev => [...prev, msg])

  const runPrompt = async (text: string) => {
    if (!studentContext || sending) return
    setTab('chat')
    setSending(true)
    pushMessage({ id: nextId(), role: 'user', content: text })
    try {
      const response = await sendMentorMessage(
        text,
        studentContext,
        messages.map(m => ({ role: m.role, content: m.card ? m.card.content : m.content })),
        { page: 'dashboard', contextData: {} },
      )
      pushMessage({ id: nextId(), role: 'assistant', content: response.content, card: response })
    } catch (e) {
      pushMessage({
        id: nextId(),
        role: 'assistant',
        content: '',
        card: { type: 'error', title: 'Не удалось получить ответ', content: e instanceof Error ? e.message : 'Попробуй ещё раз чуть позже.', actions: [] },
      })
    } finally {
      setSending(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    await runPrompt(text)
  }

  const handleGeneratePlan = async () => {
    if (!studentContext || generatingPlan) return
    setGeneratingPlan(true)
    try {
      const response = await sendMentorMessage(
        'Составь мне подробный план подготовки на сегодня — конкретные задачи с числами (сколько вопросов, по какой теме), которые можно отметить галочкой по мере выполнения.',
        studentContext,
        [],
        { page: 'dashboard', contextData: {} },
      )
      storePlan(response)
      setPlan(response)
      setCheckedItems(new Set())
    } catch {
      setPlan({ type: 'error', title: 'Не удалось составить план', content: 'Попробуй ещё раз чуть позже.', actions: [] })
    } finally {
      setGeneratingPlan(false)
    }
  }

  const handleToggleItem = (index: number) => {
    setCheckedItems(togglePlanItem(index))
  }

  if (loading) return <LoadingScreen />

  const current = latestScore ?? 0
  const weakest = weakSections[0] ?? null
  const projection = projectScore(current, weakest)
  const recommendedCount = weakest ? recommendedPracticeCount(weakest) : 0
  const heroRecommendation = weakest
    ? `Твоя слабая тема: ${weakest.label}. Реши ${recommendedCount} вопросов, чтобы подтянуть её.`
    : 'Пройди пару практик или пробный ОРТ — тогда я найду твою слабую тему и подскажу, что подтянуть.'

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Brain size={22} className="text-[#1B4FD8]" />
          <h1 className="text-xl font-bold text-[#191B23]">AI Mentor</h1>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Icon size={15} /> {t.label}
              </button>
            )
          })}
        </div>

        <div className="mt-5 space-y-5">
          {tab === 'home' && (
            <>
              <AIHeroCard name={studentContext?.name ?? 'Студент'} recommendation={heroRecommendation} onStart={() => runPrompt('Что мне делать сегодня, чтобы улучшить результат?')} />

              <AIQuickActions onAction={runPrompt} />

              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
                  <Target size={16} className="text-[#1B4FD8]" /> Прогноз балла
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div>
                    <div className="text-3xl font-extrabold text-[#191B23]">{projection.current}</div>
                    <div className="text-xs text-gray-400">Текущий балл</div>
                  </div>
                  <TrendingUp size={20} className="text-gray-300" />
                  <div>
                    <div className="text-3xl font-extrabold text-green-600">{projection.projected}</div>
                    <div className="text-xs text-gray-400">Если подтянуть слабую тему</div>
                  </div>
                  {projection.gain > 0 && (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-600">+{projection.gain}</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-400">Цель: {targetScore} баллов</p>
              </div>

              {weakSections.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
                    <PenLine size={16} className="text-[#1B4FD8]" /> Быстрая практика по темам
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {weakSections.slice(0, 4).map(s => (
                      <Link
                        key={s.section}
                        href={`/student/online/practice?section=${encodeURIComponent(s.section)}&topic=${encodeURIComponent(s.label)}`}
                        className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-[#1B4FD8] hover:bg-[#EEF2FF]"
                      >
                        <div>
                          <div className="text-sm font-bold text-[#191B23]">{s.label}</div>
                          <div className="text-xs text-gray-400">{s.wrongCount} неверных ответов</div>
                        </div>
                        <span className="text-sm font-bold text-[#1B4FD8]">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 text-sm font-bold text-[#191B23]">
                  <Clock size={16} className="text-[#1B4FD8]" /> Последняя активность
                </div>
                {activity.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">Пока нет завершённых попыток</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {activity.map(item => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-6 py-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.type === 'mock' ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'bg-amber-50 text-amber-600'}`}>
                          {item.type === 'mock' ? <ClipboardList size={15} /> : <PenLine size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[#191B23]">{item.title}</div>
                          <div className="text-xs text-gray-400">{new Date(item.completedAt).toLocaleDateString('ru')}</div>
                        </div>
                        <div className="text-sm font-bold text-[#1B4FD8]">{item.score}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'chat' && (
            <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col rounded-2xl border border-gray-200 bg-white">
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="pt-16 text-center text-sm text-gray-400">
                    <Sparkles size={20} className="mx-auto mb-2 text-gray-300" />
                    Спроси что угодно про подготовку к ОРТ
                  </div>
                ) : (
                  messages.map(m => m.role === 'user' ? (
                    <div key={m.id} className="animate-ai-fade-in ml-10 rounded-2xl rounded-tr-sm bg-[#1B4FD8] px-4 py-2.5 text-sm text-white sm:ml-24">
                      {m.content}
                    </div>
                  ) : (
                    <div key={m.id} className="mr-10 sm:mr-24">
                      <AIMessageCard response={m.card ?? { type: 'theory', title: '', content: m.content, actions: [] }} onActionClick={runPrompt} />
                    </div>
                  ))
                )}
                {sending && <AITypingIndicator />}
              </div>

              <div className="flex items-center gap-2 border-t border-gray-200 p-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                  placeholder="Напиши вопрос..."
                  disabled={sending}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  aria-label="Отправить"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B4FD8] text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <AIAnalytics scoreHistory={scoreHistory} sections={weakSections} targetScore={targetScore} />
          )}

          {tab === 'plan' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#191B23]">План на сегодня</h2>
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  <RefreshCw size={14} className={generatingPlan ? 'animate-spin' : ''} />
                  {plan ? 'Обновить план' : 'Составить план'}
                </button>
              </div>

              {generatingPlan ? (
                <AITypingIndicator />
              ) : plan ? (
                <AIMessageCard response={plan} checkedItems={checkedItems} onToggleItem={handleToggleItem} />
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
                  План на сегодня ещё не составлен — нажми «Составить план», и AI Mentor подготовит задачи с учётом твоих слабых тем.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
