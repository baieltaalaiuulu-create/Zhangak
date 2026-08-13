'use client'

import Link from 'next/link'
import { Menu, BarChart2, X } from 'lucide-react'

interface Props {
  firstName: string
  currentScore: number
  targetScore: number
  showAnalyticsToggle: boolean
  analyticsOpen: boolean
  onToggleAnalytics: () => void
  onOpenSidebar: () => void
}

export default function ChatTopbar({
  firstName, currentScore, targetScore, showAnalyticsToggle, analyticsOpen, onToggleAnalytics, onOpenSidebar,
}: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Открыть меню бесед"
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-50 lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="min-w-0 truncate text-sm font-semibold text-gray-500">
        <Link href="/student/online" className="hover:text-[#1B3F92]">AI Mentor</Link>
        <span className="mx-1.5 text-gray-300">·</span>
        <span className="text-gray-900">{firstName}</span>
        <span className="text-gray-400"> {currentScore} / {targetScore} баллов</span>
      </div>

      {showAnalyticsToggle && (
        <button
          type="button"
          onClick={onToggleAnalytics}
          className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors lg:hidden ${
            analyticsOpen ? 'bg-[#1B3F92] text-white' : 'bg-gray-50 text-gray-600'
          }`}
        >
          {analyticsOpen ? <X size={14} /> : <BarChart2 size={14} />}
          Аналитика
        </button>
      )}
    </header>
  )
}
