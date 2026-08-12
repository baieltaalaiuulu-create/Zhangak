'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpenText, CalendarDays, SearchCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore } from '@/lib/profile-data'
import {
  fetchStudentContext, streamMentorMessage,
  type StudentContext, type MentorCardType,
} from '@/lib/ai-mentor-data'
import {
  fetchChatSessions, createChatSession, renameChatSession, togglePinSession, deleteChatSession,
  fetchChatMessages, saveChatMessage, deriveSessionTitle,
  type ChatSession,
} from '@/lib/ai-chat-data'
import { fetchPanelData, type PanelData, type ErrorReviewItem } from '@/lib/ai-chat-panel-data'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import ChatSidebar from '@/components/student/ai-chat/ChatSidebar'
import ChatTopbar from '@/components/student/ai-chat/ChatTopbar'
import ChatHeroCard from '@/components/student/ai-chat/ChatHeroCard'
import QuickStartGrid from '@/components/student/ai-chat/QuickStartGrid'
import ChatBubble from '@/components/student/ai-chat/ChatBubble'
import ChatTypingIndicator from '@/components/student/ai-chat/ChatTypingIndicator'
import ChatInputBar from '@/components/student/ai-chat/ChatInputBar'
import AnalyticsPanel from '@/components/student/ai-chat/AnalyticsPanel'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: string[]
}

let idCounter = 0
function nextId(): string { idCounter += 1; return `m${idCounter}` }

const AUTO_GREETING_PROMPT = 'Поприветствуй меня как мой персональный AI-наставник по подготовке к ОРТ. Кратко перечисли мои последние данные: последний балл ОРТ, сколько баллов осталось до цели, и оцени вероятность достижения цели в процентах. Затем дай 2-3 конкретные рекомендации на сегодня, основываясь на моих слабых темах и последних ошибках. Заверши тёплым вопросом о том, с чего начать. Будь кратким, дружелюбным и не используй эмодзи.'

function LoadingScreen() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D1A', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка AI Mentor...</div>
    </div>
  )
}

export default function AiMentorChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('Студент')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [xp, setXp] = useState(0)
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null)
  const [panelData, setPanelData] = useState<PanelData | null>(null)

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileAnalyticsOpen, setMobileAnalyticsOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Bootstrap: auth + profile + AI context + panel data + a fresh
  // greeted session (persisted only once the greeting actually arrives). ──
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type, full_name, target_score, avatar_url')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setStudentId(user.id)
      setFullName(profile.full_name ?? 'Студент')
      setAvatarUrl(profile.avatar_url ?? null)
      setTargetScore(profile.target_score ?? DEFAULT_TARGET_SCORE)

      const [latest, context, panel, existingSessions, { count }] = await Promise.all([
        fetchLatestMockScore(user.id),
        fetchStudentContext(user.id),
        fetchPanelData(user.id),
        fetchChatSessions(user.id),
        supabase.from('practice_results').select('*', { count: 'exact', head: true }).eq('student_id', user.id).not('completed_at', 'is', null),
      ])

      setLatestScore(latest)
      setStudentContext(context)
      setPanelData(panel)
      setSessions(existingSessions)
      setXp((count ?? 0) * 10)
      setLoading(false)
    }
    init()
  }, [router])

  // Kick off the auto-greeted new session once context is ready.
  useEffect(() => {
    if (!loading && studentContext && studentId && activeSessionId === null && messages.length === 0) {
      startNewSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, studentContext, studentId])

  const pushMessage = (msg: ChatMessage) => setMessages(prev => [...prev, msg])

  async function startNewSession() {
    if (!studentContext || !studentId || sending) return
    setSending(true)
    setActiveSessionId(null)
    const assistantId = nextId()
    setMessages([{ id: assistantId, role: 'assistant', content: '' }])

    let finalContent = ''
    let finalActions: string[] = []
    try {
      await streamMentorMessage(
        AUTO_GREETING_PROMPT, studentContext, [], { page: 'dashboard', contextData: {} }, undefined,
        update => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: update.content, actions: update.actions } : m))
          if (update.done) { finalContent = update.content; finalActions = update.actions }
        },
      )
      const session = await createChatSession(studentId, 'Новая беседа')
      await saveChatMessage(session.id, 'assistant', finalContent || 'Привет! Чем могу помочь сегодня?')
      setActiveSessionId(session.id)
      setSessions(prev => [session, ...prev])
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalContent, actions: finalActions } : m))
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: e instanceof Error ? e.message : 'Не удалось получить приветствие. Напиши мне что-нибудь ниже — начнём беседу.' }
        : m))
    } finally {
      setSending(false)
    }
  }

  async function sendMessage(text: string, expectedType?: MentorCardType) {
    const trimmed = text.trim()
    if (!trimmed || !studentContext || !studentId || sending) return
    setSending(true)

    pushMessage({ id: nextId(), role: 'user', content: trimmed })
    const assistantId = nextId()
    pushMessage({ id: assistantId, role: 'assistant', content: '' })

    const sessionId = activeSessionId
    const historyTurns = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      if (sessionId) {
        await saveChatMessage(sessionId, 'user', trimmed)
        const session = sessions.find(s => s.id === sessionId)
        if (session && (!session.title || session.title === 'Новая беседа')) {
          const title = deriveSessionTitle(trimmed)
          await renameChatSession(sessionId, title)
          setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s))
        }
      }

      await streamMentorMessage(
        trimmed, studentContext, historyTurns, { page: 'dashboard', contextData: {} }, expectedType,
        update => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: update.content, actions: update.actions } : m))
          if (update.done && sessionId) saveChatMessage(sessionId, 'assistant', update.content)
        },
      )
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: e instanceof Error ? e.message : 'Соединение прервано. Попробуй ещё раз.' }
        : m))
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }

  const handleSelectSession = async (id: string) => {
    if (id === activeSessionId || sending) return
    setMobileSidebarOpen(false)
    setActiveSessionId(id)
    const rows = await fetchChatMessages(id)
    setMessages(rows.map(r => ({ id: r.id, role: r.role, content: r.content })))
  }

  const handleTogglePin = async (session: ChatSession) => {
    const nextPinned = !session.is_pinned
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, is_pinned: nextPinned } : s))
    await togglePinSession(session.id, nextPinned)
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteChatSession(deleteTarget.id)
      setSessions(prev => prev.filter(s => s.id !== deleteTarget.id))
      if (deleteTarget.id === activeSessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleReviewError = (item: ErrorReviewItem) => {
    setMobileAnalyticsOpen(false)
    sendMessage(`Разбери подробно мои последние ошибки по теме «${item.label}» и объясни, как их избежать.`, 'analysis')
  }

  if (loading || !studentContext || !panelData) return <LoadingScreen />

  const firstName = fullName.split(' ')[0]
  const showIntro = messages.length <= 1

  const quickStartItems = [
    { icon: <BookOpenText size={19} aria-hidden="true" />, label: 'Объяснить тему', action: () => sendMessage('Объясни мне одну из тем, где у меня больше всего ошибок, простым языком с примером.') },
    { icon: <SearchCheck size={19} aria-hidden="true" />, label: 'Разобрать ошибку', action: () => sendMessage('Разбери подробно мои последние ошибки и объясни, как их избежать.', 'analysis') },
    { icon: <CalendarDays size={19} aria-hidden="true" />, label: 'Составить план', action: () => sendMessage('Составь мне подробный план подготовки на сегодня.', 'plan') },
  ]

  const todayGoalLabel = [panelData.weakestLabel, panelData.secondWeakestLabel].filter(Boolean).join(' + ')

  return (
    <div className="flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] overflow-hidden bg-[#F4F6FA] md:h-screen">
      {/* Left sidebar — desktop */}
      <div className="hidden lg:block lg:w-[260px] lg:shrink-0">
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={startNewSession}
          onTogglePin={handleTogglePin}
          onDeleteSession={setDeleteTarget}
          query={query}
          onQueryChange={setQuery}
          fullName={fullName}
          avatarUrl={avatarUrl}
          xp={xp}
          streak={studentContext.streak}
        />
      </div>

      {/* Left sidebar — mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[260px] max-w-[85vw]">
            <ChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={() => { startNewSession(); setMobileSidebarOpen(false) }}
              onTogglePin={handleTogglePin}
              onDeleteSession={setDeleteTarget}
              query={query}
              onQueryChange={setQuery}
              fullName={fullName}
              avatarUrl={avatarUrl}
              xp={xp}
              streak={studentContext.streak}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatTopbar
          firstName={firstName}
          currentScore={latestScore ?? 0}
          targetScore={targetScore}
          showAnalyticsToggle
          analyticsOpen={mobileAnalyticsOpen}
          onToggleAnalytics={() => setMobileAnalyticsOpen(v => !v)}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {showIntro && (
                <>
                  <div className="hidden sm:block">
                    <ChatHeroCard
                      firstName={firstName}
                      todayGoalLabel={todayGoalLabel}
                      targetScore={targetScore}
                      remaining={panelData.goal.remaining}
                      probabilityPct={panelData.goal.pct}
                      minutesTodayLabel={panelData.miniStats.minutesToday >= 60 ? `${Math.floor(panelData.miniStats.minutesToday / 60)}ч ${panelData.miniStats.minutesToday % 60}м` : `${panelData.miniStats.minutesToday}м`}
                      tasksDoneToday={panelData.miniStats.tasksDoneToday}
                      tasksGoalToday={panelData.miniStats.tasksGoalToday}
                      latestMockScore={latestScore}
                      continueHref="/student/online/lessons"
                      onReviewErrors={() => sendMessage('Разбери подробно мои последние ошибки и объясни, как их избежать.', 'analysis')}
                    />
                  </div>
                  <QuickStartGrid items={quickStartItems} />
                </>
              )}

              {messages.map(m => (
                m.content || m.role === 'user'
                  ? <ChatBubble key={m.id} role={m.role} content={m.content} actions={m.actions} onActionClick={a => sendMessage(a)} />
                  : <ChatTypingIndicator key={m.id} />
              ))}
            </div>

            <ChatInputBar value={input} onChange={setInput} onSend={handleSend} disabled={sending} />
          </div>

          <div className="hidden w-[320px] shrink-0 border-l border-gray-100 lg:block">
            <AnalyticsPanel data={panelData} onReviewError={handleReviewError} />
          </div>
        </div>
      </div>

      {/* Analytics — mobile overlay */}
      {mobileAnalyticsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileAnalyticsOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 w-[320px] max-w-[90vw]">
            <AnalyticsPanel data={panelData} onReviewError={handleReviewError} />
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление беседы"
          message={`Удалить беседу "${deleteTarget.title || 'Новая беседа'}"? Это действие необратимо.`}
          loading={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
