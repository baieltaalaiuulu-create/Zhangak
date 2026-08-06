'use client'

import { Sparkles } from 'lucide-react'

interface Props {
  name: string
  recommendation: string
  onStart: () => void
}

// The "AI orb" — a glowing gradient circle with a soft pulse, standing in
// for an avatar since there's no illustration asset for this.
function AiOrb() {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <span
        className="absolute inset-0 animate-pulse rounded-full opacity-60 blur-md"
        style={{ background: 'radial-gradient(circle, #60A5FA 0%, #7C3AED 70%, transparent 100%)' }}
      />
      <span
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg"
        style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #7C3AED 100%)' }}
      >
        <Sparkles size={20} />
      </span>
    </div>
  )
}

export default function AIHeroCard({ name, recommendation, onStart }: Props) {
  const firstName = name.split(' ')[0]

  return (
    <div className="overflow-hidden rounded-2xl shadow-sm">
      <div
        className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e2d4e 100%)' }}
      >
        <div className="flex items-start gap-4">
          <AiOrb />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-300">AI Mentor</p>
            <h2 className="mt-1 text-lg font-bold text-white">Привет, {firstName}! 👋</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-gray-300">{recommendation}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="shrink-0 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          Спросить AI Mentor →
        </button>
      </div>
    </div>
  )
}
