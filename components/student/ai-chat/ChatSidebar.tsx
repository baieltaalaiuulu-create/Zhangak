'use client'

import { Plus, Search, Pin, Trash2 } from 'lucide-react'
import type { ChatSession } from '@/lib/ai-chat-data'

interface Props {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
  onTogglePin: (session: ChatSession) => void
  onDeleteSession: (session: ChatSession) => void
  query: string
  onQueryChange: (v: string) => void
  fullName: string
  avatarUrl: string | null
  xp: number
  streak: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function SessionRow({ session, active, onSelect, onTogglePin, onDelete }: {
  session: ChatSession
  active: boolean
  onSelect: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{session.title || 'Новая беседа'}</p>
        <p className="text-[11px] text-gray-500">{formatDate(session.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onTogglePin() }}
        aria-label={session.is_pinned ? 'Открепить' : 'Закрепить'}
        className={`shrink-0 rounded-lg p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100 ${session.is_pinned ? '!opacity-100 text-[#8B5CF6]' : 'text-gray-500'}`}
      >
        <Pin size={13} fill={session.is_pinned ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete() }}
        aria-label="Удалить беседу"
        className="shrink-0 rounded-lg p-1 text-gray-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function ChatSidebar({
  sessions, activeSessionId, onSelectSession, onNewChat, onTogglePin, onDeleteSession,
  query, onQueryChange, fullName, avatarUrl, xp, streak,
}: Props) {
  const q = query.trim().toLowerCase()
  const filtered = q ? sessions.filter(s => (s.title ?? '').toLowerCase().includes(q)) : sessions
  const pinned = filtered.filter(s => s.is_pinned)
  const recent = filtered.filter(s => !s.is_pinned)
  const initial = fullName?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="flex h-full w-full flex-col" style={{ background: '#0D0D1A' }}>
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}>
          AI
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0D0D1A]" style={{ background: '#22C55E' }} />
        </span>
        <span className="text-sm font-extrabold text-white">AI Mentor</span>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
        >
          <Plus size={16} /> Новая беседа
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Поиск..."
            className="w-full rounded-lg bg-white/5 py-2 pl-8 pr-3 text-xs text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {pinned.length > 0 && (
          <div>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-gray-500">Закреплённые</p>
            <div className="space-y-0.5">
              {pinned.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  onSelect={() => onSelectSession(s.id)}
                  onTogglePin={() => onTogglePin(s)}
                  onDelete={() => onDeleteSession(s)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-gray-500">Недавние</p>
          {recent.length === 0 ? (
            <p className="px-3 text-xs text-gray-600">Пока нет бесед</p>
          ) : (
            <div className="space-y-0.5">
              {recent.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  onSelect={() => onSelectSession(s.id)}
                  onTogglePin={() => onTogglePin(s)}
                  onDelete={() => onDeleteSession(s)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-white/5 px-4 py-3.5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, no next/image domain config in this project
          <img src={avatarUrl} alt={fullName} className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: '#6C3DE0' }}>
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{fullName}</p>
          <p className="text-[10px] text-gray-500">{xp} XP</p>
        </div>
        {streak > 0 && (
          <span className="shrink-0 text-xs font-bold text-orange-400">🔥 {streak}</span>
        )}
      </div>
    </aside>
  )
}
