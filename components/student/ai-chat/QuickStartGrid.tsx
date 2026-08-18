'use client'

import type { ReactNode } from 'react'

interface QuickStartItem {
  icon: ReactNode
  label: string
  action: () => void
}

interface Props {
  items: QuickStartItem[]
}

export default function QuickStartGrid({ items }: Props) {
  return (
    <div aria-label="Быстрые действия AI">
      <h2 className="mb-2 text-sm font-bold text-gray-700">Как я могу помочь?</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-[#6C3DE0]/30 hover:bg-[#F5F3FF]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#6C3DE0]">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
