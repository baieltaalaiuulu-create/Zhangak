'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, BrainCircuit, LoaderCircle, Send, ShieldCheck } from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import { ZhangakApiError, zhangakApiJson, zhangakApiRequest } from '@/lib/zhangak-api-client'

type Message = { id: number; role: 'user' | 'assistant'; content: string; createdAt: string }

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return Number.isSafeInteger(row.id)
    && (row.role === 'user' || row.role === 'assistant')
    && typeof row.content === 'string'
    && typeof row.createdAt === 'string'
}

export default function AiMentorChatPage() {
  const user = useStudentSession()
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Студент'
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('loading')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([
      zhangakApiRequest<{ accepted?: unknown }>('/v1/platform/ai/consent'),
      zhangakApiRequest<{ items?: unknown }>('/v1/platform/ai/messages'),
    ]).then(([consent, history]) => {
      if (!active) return
      setAccepted(consent.accepted === true)
      setMessages(Array.isArray(history.items) ? history.items.filter(isMessage) : [])
      setStatus('ready')
    }).catch(error => {
      if (!active) return
      setNotice(error instanceof ZhangakApiError ? error.message : 'Не удалось открыть AI-коуча')
      setStatus('error')
    })
    return () => { active = false }
  }, [])

  async function saveConsent() {
    setStatus('saving-consent')
    setNotice('')
    try {
      await zhangakApiJson('/v1/platform/ai/consent', 'POST', { accepted: true })
      setAccepted(true)
      setStatus('ready')
    } catch (error) {
      setNotice(error instanceof ZhangakApiError ? error.message : 'Не удалось сохранить согласие')
      setStatus('error')
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()
    if (!message || status !== 'ready' || !accepted) return
    setStatus('sending')
    setNotice('')
    setInput('')
    const optimistic: Message = { id: -Date.now(), role: 'user', content: message, createdAt: new Date().toISOString() }
    setMessages(current => [...current, optimistic])
    try {
      const result = await zhangakApiJson<{ message?: unknown }>('/v1/platform/ai/messages', 'POST', { message })
      if (!isMessage(result.message)) throw new Error('invalid_response')
      const assistantMessage: Message = result.message
      setMessages(current => [...current.filter(item => item.id !== optimistic.id), { ...optimistic, id: Math.abs(optimistic.id) }, assistantMessage])
      setStatus('ready')
    } catch (error) {
      setMessages(current => current.filter(item => item.id !== optimistic.id))
      setInput(message)
      setNotice(error instanceof ZhangakApiError ? error.message : 'AI-коуч не ответил. Попробуй ещё раз.')
      setStatus('ready')
    }
  }

  return (
    <main className="min-h-[calc(100dvh-64px-env(safe-area-inset-bottom))] bg-[#F4F6FA] px-4 py-7 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-3xl">
        <Link href="/student/online" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900">
          <ArrowLeft size={17} aria-hidden="true" /> На главную
        </Link>

        <div className="mt-4 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
          <header className="bg-gradient-to-br from-[#0D1E4A] via-[#1B3F92] to-[#6C3DE0] px-6 py-7 text-white sm:px-9">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><BrainCircuit size={25} aria-hidden="true" /></span>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-blue-100">AI-коуч Zhangak</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{firstName}, спроси про математику или кыргызский язык</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50">Коуч помогает с подготовкой к ОРТ. Он может ошибаться — сверяй важные ответы с учебными материалами.</p>
          </header>

          <div className="p-5 sm:p-7">
            {status === 'loading' && <p className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="animate-spin" size={18} /> Загружаем защищённую беседу…</p>}
            {status === 'error' && (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                <p>{notice}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/student/online/lessons" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#1B3F92]">Открыть уроки</Link>
                  <Link href="/student/online/practice" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#1B3F92]">Открыть тренажёр</Link>
                </div>
              </div>
            )}

            {status !== 'loading' && accepted === false && (
              <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <h2 className="text-base font-bold text-slate-900">Согласие на AI-помощь</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">Твои сообщения будут отправляться защищённому AI-провайдеру для ответа. Не отправляй пароли, номера документов и личные данные других людей. История доступна только тебе и хранится в Zhangak.</p>
                <button type="button" onClick={() => void saveConsent()} disabled={status === 'saving-consent'} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:opacity-60">
                  {status === 'saving-consent' ? 'Сохраняем…' : 'Согласен, открыть чат'}
                </button>
              </section>
            )}

            {status !== 'loading' && accepted === true && (
              <>
                <div className="max-h-[48vh] min-h-40 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-live="polite">
                  {messages.length === 0 && <p className="p-3 text-sm leading-6 text-slate-600">Например: «Объясни, как решать квадратные уравнения» или «Помоги разобрать правило кыргызского языка».</p>}
                  {messages.map(message => <div key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-[#1B3F92] text-white' : 'bg-white text-slate-800 shadow-sm'}`}>{message.content}</div>)}
                  {status === 'sending' && <p className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={16} /> AI-коуч думает…</p>}
                </div>
                {notice && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{notice}</p>}
                <form onSubmit={send} className="mt-4 flex gap-2">
                  <label className="sr-only" htmlFor="ai-message">Сообщение AI-коучу</label>
                  <textarea id="ai-message" value={input} onChange={event => setInput(event.target.value)} maxLength={2000} rows={2} placeholder="Напиши свой вопрос…" className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-[#1B3F92] focus:ring-2" />
                  <button type="submit" disabled={status !== 'ready' || !input.trim()} className="inline-flex min-h-12 w-12 items-center justify-center rounded-xl bg-[#1B3F92] text-white disabled:opacity-50" aria-label="Отправить сообщение"><Send size={18} aria-hidden="true" /></button>
                </form>
              </>
            )}
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={16} aria-hidden="true" /> Лимит защиты: до 8 сообщений за 15 минут. AI не меняет твои результаты, XP или ответы в тестах.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
