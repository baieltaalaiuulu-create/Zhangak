'use client'

import { useEffect, useState } from 'react'

interface Props {
  targetIso: string
  onComplete?: () => void
}

function msUntil(targetIso: string): number {
  return Math.max(0, new Date(targetIso).getTime() - Date.now())
}

export default function CountdownTimer({ targetIso, onComplete }: Props) {
  const [remainingMs, setRemainingMs] = useState(() => msUntil(targetIso))

  useEffect(() => {
    const timer = window.setInterval(() => {
      const ms = msUntil(targetIso)
      setRemainingMs(ms)
      if (ms <= 0) {
        window.clearInterval(timer)
        // Deferred to a macrotask so a parent's setState (e.g. re-fetching
        // session status) triggered by onComplete doesn't run synchronously
        // inside this effect — same pattern as the mock exam's own countdown.
        if (onComplete) window.setTimeout(onComplete, 0)
      }
    }, 1000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso])

  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const units = [
    { value: days, label: 'дн' },
    { value: hours, label: 'ч' },
    { value: minutes, label: 'мин' },
    { value: seconds, label: 'сек' },
  ]

  return (
    <div className="flex gap-2 sm:gap-3">
      {units.map(u => (
        <div key={u.label} className="min-w-[60px] rounded-xl bg-white/15 px-3 py-2 text-center sm:min-w-[64px]">
          <div className="text-2xl font-extrabold tabular-nums sm:text-xl">{String(u.value).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wide text-blue-100">{u.label}</div>
        </div>
      ))}
    </div>
  )
}
