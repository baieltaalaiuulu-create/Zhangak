'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  icon: ReactNode
  label: string
  completed: number
  total: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export default function MobileSubjectAccordion({ icon, label, completed, total, open, onToggle, children }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1B4FD8]">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#191B23]">{label}</span>
            <span className="shrink-0 text-xs font-semibold text-gray-400">{completed}/{total} уроков</span>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100">
            <span className="block h-full rounded-full bg-[#1B4FD8] transition-all duration-700" style={{ width: `${pct}%` }} />
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && <div className="divide-y divide-gray-50 border-t border-gray-50">{children}</div>}
    </div>
  )
}
