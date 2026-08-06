import { supabase } from '@/lib/supabase'

// ── Announcements (student-facing reads) ────────────────────────────────
// Admin CRUD lives in lib/admin-data.ts (AdminAnnouncement) — this is the
// read-only shape/query students need, reused by both the dashboard banner
// and the popup queue below.

export interface Announcement {
  id: string
  title: string
  body: string
  created_at: string
}

export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ── Popup notification queue (announcements + upcoming mock ORTs) ───────

export type NotificationItem =
  | { id: string; kind: 'announcement'; title: string; body: string }
  | { id: string; kind: 'mock'; title: string; scheduledAt: string; sessionId: number }

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

interface UpcomingMockRow {
  id: number
  title: string
  scheduled_at: string | null
}

async function fetchUpcomingMockNotifications(): Promise<NotificationItem[]> {
  const now = new Date()
  const in7d = new Date(now.getTime() + UPCOMING_WINDOW_MS)
  const { data } = await supabase
    .from('practice_tests')
    .select('id, title, scheduled_at')
    .eq('type', 'mock')
    .eq('is_active', true)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in7d.toISOString())
    .order('scheduled_at', { ascending: true })

  return ((data ?? []) as UpcomingMockRow[]).map(s => ({
    id: `mock:${s.id}`,
    kind: 'mock' as const,
    title: s.title,
    scheduledAt: s.scheduled_at as string,
    sessionId: s.id,
  }))
}

export async function fetchNotificationItems(): Promise<NotificationItem[]> {
  const [announcements, mocks] = await Promise.all([
    fetchActiveAnnouncements(),
    fetchUpcomingMockNotifications(),
  ])
  const announcementItems: NotificationItem[] = announcements.map(a => ({
    id: `announcement:${a.id}`, kind: 'announcement', title: a.title, body: a.body,
  }))
  // Upcoming mocks first — a scheduled exam is more time-sensitive than a
  // general announcement.
  return [...mocks, ...announcementItems]
}

// ── localStorage dismissal tracking ──────────────────────────────────────
// Two independent keys: the popup queue (one-time modal nag) and the
// dashboard banner (persistent until explicitly closed) are separate
// surfaces — dismissing one shouldn't silently hide the other.

const POPUP_DISMISSED_KEY = 'zhangak_dismissed_notifications'
const BANNER_DISMISSED_KEY = 'zhangak_dismissed_announcement_banners'

function readIdSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(key)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function addToIdSet(key: string, id: string): void {
  if (typeof window === 'undefined') return
  const ids = readIdSet(key)
  ids.add(id)
  window.localStorage.setItem(key, JSON.stringify([...ids]))
}

export function getDismissedPopupIds(): Set<string> { return readIdSet(POPUP_DISMISSED_KEY) }
export function markPopupDismissed(id: string): void { addToIdSet(POPUP_DISMISSED_KEY, id) }

export function getDismissedBannerIds(): Set<string> { return readIdSet(BANNER_DISMISSED_KEY) }
export function markBannerDismissed(id: string): void { addToIdSet(BANNER_DISMISSED_KEY, id) }
