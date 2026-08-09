'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { askAIMentor } from '@/lib/ai-quick-ask'

interface Props {
  lessonTitle: string
}

const CHIPS: { label: string; build: (title: string) => string }[] = [
  { label: 'Объясни проще', build: title => `Объясни тему урока «${title}» проще, простыми словами.` },
  { label: 'Покажи пример', build: title => `Покажи пример решения по теме урока «${title}».` },
  { label: 'Помоги с задачей', build: title => `Помоги мне решить задачу по теме урока «${title}».` },
]

// Collapsed by default — expands into 3 chips that hand a pre-built,
// lesson-context message to the existing floating AIDrawer (via
// lib/ai-quick-ask.ts) rather than opening the full /student/online/ai page.
export default function MobileAIHelp({ lessonTitle }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold text-[#1B4FD8]"
      >
        <Sparkles size={16} className="shrink-0" />
        Не понял тему? → Спросить AI
      </button>

      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIPS.map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => askAIMentor(chip.build(lessonTitle))}
              className="flex min-h-11 items-center rounded-full border border-[#1B4FD8]/20 bg-[#EEF2FF] px-3 py-2 text-xs font-bold text-[#1B4FD8]"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
