'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, X, Send, Maximize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchLessonById } from '@/lib/lessons-data'
import {
  fetchStudentContext, streamMentorMessage,
  type StudentContext, type PageContext, type ChatMessage, type MentorCardType,
} from '@/lib/ai-mentor-data'
import AIMessageCard from './AIMessageCard'
import AITypingIndicator from './AITypingIndicator'

const LESSON_ROUTE = /^\/student\/online\/lessons\/([^/]+)$/
const PRACTICE_ROUTE = /^\/student\/online\/practice/
const MOCK_RESULTS_ROUTE = /^\/student\/online\/mock\/([^/]+)\/results/
const DASHBOARD_ROUTE = /^\/student\/online\/?$/
const PROFILE_ROUTE = /^\/student\/online\/profile/
const AI_PAGE_ROUTE = /^\/student\/online\/ai/

interface RouteContext {
  pageContext: PageContext
  proactiveMessage: string | null
  autoOpen: boolean
  autoPrompt: string | null
}

let messageIdCounter = 0
function nextMessageId(): string {
  messageIdCounter += 1
  return `m${messageIdCounter}`
}

export default function AIDrawer() {
  const pathname = usePathname()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [routeCtx, setRouteCtx] = useState<RouteContext | null>(null)
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const autoTriggeredForPath = useRef<string | null>(null)
  const introShownForPath = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Lightweight auth check — mirrors NotificationPopup's pattern. Only
  // needs the id; name/score/etc are pulled in lazily via
  // fetchStudentContext once the drawer is actually opened.
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setStudentId(user?.id ?? null)
    }
    load()
  }, [])

  // Resolve page-specific proactive context whenever the route changes.
  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      const lessonMatch = pathname?.match(LESSON_ROUTE)
      const mockResultsMatch = pathname?.match(MOCK_RESULTS_ROUTE)

      if (lessonMatch) {
        const lesson = await fetchLessonById(lessonMatch[1])
        if (cancelled) return
        setRouteCtx({
          pageContext: { page: 'lesson', contextData: { lessonId: lessonMatch[1], title: lesson?.title ?? null } },
          proactiveMessage: lesson ? `Вижу урок «${lesson.title}». Объяснить перед просмотром?` : null,
          autoOpen: false,
          autoPrompt: null,
        })
      } else if (PRACTICE_ROUTE.test(pathname ?? '')) {
        setRouteCtx({
          pageContext: { page: 'practice', contextData: {} },
          proactiveMessage: 'После теста разберём ошибки.',
          autoOpen: false,
          autoPrompt: null,
        })
      } else if (mockResultsMatch) {
        setRouteCtx({
          pageContext: { page: 'mock', contextData: { testId: mockResultsMatch[1] } },
          proactiveMessage: null,
          autoOpen: true,
          autoPrompt: 'Проанализируй мой последний результат пробного ОРТ и дай совет, что подтянуть дальше.',
        })
      } else if (DASHBOARD_ROUTE.test(pathname ?? '')) {
        setRouteCtx({
          pageContext: { page: 'dashboard', contextData: {} },
          proactiveMessage: null, // filled in once weak-section data is loaded, see below
          autoOpen: false,
          autoPrompt: null,
        })
      } else if (PROFILE_ROUTE.test(pathname ?? '')) {
        setRouteCtx({ pageContext: { page: 'profile', contextData: {} }, proactiveMessage: null, autoOpen: false, autoPrompt: null })
      } else {
        setRouteCtx({ pageContext: { page: 'dashboard', contextData: {} }, proactiveMessage: null, autoOpen: false, autoPrompt: null })
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [pathname])

  const ensureContext = async (): Promise<StudentContext | null> => {
    if (studentContext) return studentContext
    if (!studentId) return null
    setContextLoading(true)
    try {
      const ctx = await fetchStudentContext(studentId)
      setStudentContext(ctx)
      return ctx
    } finally {
      setContextLoading(false)
    }
  }

  const pushMessage = (msg: ChatMessage) => setMessages(prev => [...prev, msg])

  const runPrompt = async (text: string, ctxOverride?: StudentContext, expectedType?: MentorCardType) => {
    const ctx = ctxOverride ?? await ensureContext()
    if (!ctx) return
    setSending(true)
    pushMessage({ id: nextMessageId(), role: 'user', content: text })
    const assistantId = nextMessageId()
    pushMessage({ id: assistantId, role: 'assistant', content: '' })
    try {
      await streamMentorMessage(
        text,
        ctx,
        messages.map(m => ({ role: m.role, content: m.card ? m.card.content : m.content })),
        routeCtx?.pageContext,
        expectedType,
        update => {
          setMessages(prev => prev.map(m => m.id === assistantId
            ? { ...m, content: update.content, card: { type: update.type, title: update.title, content: update.content, actions: update.actions } }
            : m))
        },
      )
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, card: { type: 'error', title: 'Не удалось получить ответ', content: e instanceof Error ? e.message : 'Попробуй ещё раз чуть позже.', actions: [] } }
        : m))
    } finally {
      setSending(false)
    }
  }

  // Auto-open + auto-analyze on mock results — fires once per landing on
  // that page (guarded by the ref so re-renders / studentId settling don't
  // re-trigger it), and needs studentContext ready first.
  useEffect(() => {
    if (!routeCtx?.autoOpen || !routeCtx.autoPrompt || !studentId || !pathname) return
    if (autoTriggeredForPath.current === pathname) return
    autoTriggeredForPath.current = pathname

    const trigger = async () => {
      setOpen(true)
      const ctx = await ensureContext()
      if (ctx) await runPrompt(routeCtx.autoPrompt!, ctx, 'analysis')
    }
    trigger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCtx, studentId, pathname])

  // Dashboard's proactive line needs the weakest topic, which only exists
  // once studentContext has loaded — filled in lazily rather than blocking
  // route resolution above on a full context fetch for every navigation.
  const dashboardProactive = routeCtx?.pageContext.page === 'dashboard' && studentContext?.weakSections[0]
    ? `Сегодня рекомендую: ${studentContext.weakSections[0]}`
    : routeCtx?.pageContext.page === 'dashboard' ? null : routeCtx?.proactiveMessage ?? null

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const handleOpen = async () => {
    setOpen(true)
    if (introShownForPath.current !== pathname) {
      introShownForPath.current = pathname ?? null
      await ensureContext()
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await runPrompt(text)
  }

  if (AI_PAGE_ROUTE.test(pathname ?? '')) return null

  const introText = messages.length === 0 ? dashboardProactive : null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Открыть AI Mentor"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 hover:animate-pulse sm:right-6 md:bottom-6"
        style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #7C3AED 100%)' }}
      >
        <Sparkles size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="fixed inset-y-0 right-0 flex w-full max-w-[380px] flex-col bg-[#FAF8FF] shadow-2xl transition-transform duration-300 ease-out"
            style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #7C3AED 100%)' }}>
                <Sparkles size={15} />
              </span>
              <span className="text-sm font-bold text-[#191B23]">AI Mentor</span>
              <Link href="/student/online/ai" aria-label="Открыть на весь экран" className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-[#1B4FD8]">
                <Maximize2 size={16} />
              </Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50">
                <X size={18} />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {introText && (
                <div className="animate-ai-fade-in rounded-2xl border border-[#1B4FD8]/20 bg-[#EEF2FF] px-4 py-3 text-sm font-medium text-[#1B4FD8]">
                  {introText}
                </div>
              )}

              {messages.length === 0 && !introText && (
                <div className="pt-10 text-center text-sm text-gray-400">
                  {contextLoading ? 'Загружаю твои данные...' : 'Спроси что угодно про подготовку к ОРТ'}
                </div>
              )}

              {messages.map(m => m.role === 'user' ? (
                <div key={m.id} className="animate-ai-fade-in ml-8 rounded-2xl rounded-tr-sm bg-[#1B4FD8] px-4 py-2.5 text-sm text-white">
                  {m.content}
                </div>
              ) : m.card ? (
                <AIMessageCard key={m.id} response={m.card} onActionClick={runPrompt} />
              ) : (
                <AITypingIndicator key={m.id} />
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-gray-200 bg-white p-3">
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
        </div>
      )}
    </>
  )
}
