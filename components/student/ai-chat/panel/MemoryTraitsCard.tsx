import { Check } from 'lucide-react'
import type { MemoryTrait } from '@/lib/ai-chat-panel-data'

interface Props {
  traits: MemoryTrait[]
}

export default function MemoryTraitsCard({ traits }: Props) {
  if (traits.length === 0) return null

  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4 shadow-sm">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-green-700">AI помнит о тебе</p>
      <div className="space-y-1.5">
        {traits.map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-green-900">
            <Check size={13} className="mt-0.5 shrink-0 text-green-600" />
            <span>{t.icon} {t.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
