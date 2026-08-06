'use client'

import { useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import {
  fetchActiveAnnouncements, getDismissedBannerIds, markBannerDismissed,
  type Announcement,
} from '@/lib/notifications-data'

export default function AnnouncementBanner() {
  const [visible, setVisible] = useState<Announcement[]>([])

  useEffect(() => {
    const load = async () => {
      const announcements = await fetchActiveAnnouncements()
      const dismissed = getDismissedBannerIds()
      setVisible(announcements.filter(a => !dismissed.has(`announcement:${a.id}`)))
    }
    load()
  }, [])

  const dismiss = (id: string) => {
    markBannerDismissed(`announcement:${id}`)
    setVisible(prev => prev.filter(a => a.id !== id))
  }

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(a => (
        <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-[#1B4FD8]/20 bg-[#EEF2FF] p-4">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-[#1B4FD8]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[#191B23]">{a.title}</h3>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{a.body}</p>
          </div>
          <button type="button" onClick={() => dismiss(a.id)} aria-label="Скрыть объявление"
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white/60 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
