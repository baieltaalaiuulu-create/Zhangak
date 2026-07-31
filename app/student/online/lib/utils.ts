import type { PracticeResult } from './types'

// ORT score formula (see AGENTS/skill docs):
// ROUND(math_raw_score*1.12 + analogy_score*2 + reading_score*2 + grammar_score*1.93)
export function computeOrtScore(r: Pick<PracticeResult, 'math_raw_score' | 'analogy_score' | 'reading_score' | 'grammar_score'>): number {
  const math = r.math_raw_score ?? 0
  const analogy = r.analogy_score ?? 0
  const reading = r.reading_score ?? 0
  const grammar = r.grammar_score ?? 0
  return Math.round(math * 1.12 + analogy * 2 + reading * 2 + grammar * 1.93)
}

export function localDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

export function computeStreak(activeDates: Set<string>): number {
  const cursor = new Date()
  if (!activeDates.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (activeDates.has(localDateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function lastNDays(activeDates: Set<string>, n: number) {
  const days: { date: string; active: boolean }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = localDateKey(d)
    days.push({ date: key, active: activeDates.has(key) })
  }
  return days
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date(localDateKey(new Date()) + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
