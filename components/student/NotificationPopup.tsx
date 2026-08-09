'use client'

import { useEffect, useState } from 'react'
import { X, Calendar, Megaphone } from 'lucide-react'
import {
  fetchNotificationItems, getDismissedPopupIds, markPopupDismissed,
  type NotificationItem,
} from '@/lib/notifications-data'
import { registerForMock } from '@/lib/mock-data'

interface Props {
  studentId: string | null
  onUnreadChange?: (count: number) => void
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// Mounted once in StudentLayout — fetches active announcements + upcoming
// (next 7 days) mock ORTs, filters out whatever's already been dismissed
// (tracked in localStorage, see lib/notifications-data.ts), and shows
// whatever's left one at a time as a blocking modal. Also reports the
// unread count up to the topbar bell badge.
export default function NotificationPopup({ studentId, onUnreadChange }: Props) {
  const [queue, setQueue] = useState<NotificationItem[]>([])
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    if (!studentId) return
    const load = async () => {
      const items = await fetchNotificationItems()
      const dismissed = getDismissedPopupIds()
      const unseen = items.filter(i => !dismissed.has(i.id))
      onUnreadChange?.(unseen.length)
      setQueue(unseen)
    }
    load()
    // onUnreadChange is a setState setter passed down from StudentLayout —
    // stable across renders, safe to omit without an exhaustive-deps issue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  const current = queue[0] ?? null

  const dismiss = (id: string) => {
    markPopupDismissed(id)
    setQueue(prev => {
      const next = prev.slice(1)
      onUnreadChange?.(next.length)
      return next
    })
  }

  const handleRegister = async () => {
    if (!current || current.kind !== 'mock' || !studentId) return
    setRegistering(true)
    try {
      await registerForMock(studentId, current.sessionId)
    } finally {
      setRegistering(false)
      dismiss(current.id)
    }
  }

  if (!current) return null

  const bannerUrl = current.kind === 'announcement' ? current.imageUrl : null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, no next/image domain config
          <img src={bannerUrl} alt="" className="h-36 w-full object-cover" />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#1B4FD8]">
              {current.kind === 'mock' ? <Calendar size={18} /> : <Megaphone size={18} />}
            </div>
            <button type="button" onClick={() => dismiss(current.id)} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
              <X size={18} />
            </button>
          </div>

          <h2 className="mt-3 text-lg font-bold text-[#191B23]">{current.title}</h2>

          {current.kind === 'mock' ? (
            <>
              <p className="mt-1 text-sm text-gray-500">{formatDateTime(current.scheduledAt)}</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={handleRegister} disabled={registering}
                  className="flex-1 rounded-xl bg-[#1B4FD8] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
                  {registering ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>
                <button type="button" onClick={() => dismiss(current.id)}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
                  Позже
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500">{current.body}</p>
              <button type="button" onClick={() => dismiss(current.id)}
                className="mt-5 w-full rounded-xl bg-[#1B4FD8] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700">
                Понятно
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
