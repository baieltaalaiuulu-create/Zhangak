/**
 * Russian plural agreement.
 *
 * Russian picks one of three forms by the last one or two digits, and the
 * common `n === 1 ? a : n < 5 ? b : c` shortcut gets it wrong for anything
 * past twenty: 21 takes the singular form, 22–24 the few form, and 11–14 take
 * the many form despite ending in 1–4.
 *
 *   plural(1,  'балл', 'балла', 'баллов') -> 'балл'
 *   plural(3,  ...)                        -> 'балла'
 *   plural(11, ...)                        -> 'баллов'
 *   plural(21, ...)                        -> 'балл'
 *   plural(22, ...)                        -> 'балла'
 */
export function russianPlural(count: number, one: string, few: string, many: string): string {
  const absolute = Math.abs(Math.trunc(count))
  const lastTwo = absolute % 100
  if (lastTwo >= 11 && lastTwo <= 14) return many
  const lastOne = absolute % 10
  if (lastOne === 1) return one
  if (lastOne >= 2 && lastOne <= 4) return few
  return many
}

/** `180 баллов`, `21 балл`, `2 балла`. */
export function scoreLabel(score: number): string {
  return `${score} ${russianPlural(score, 'балл', 'балла', 'баллов')}`
}

/** `1 день`, `2 дня`, `11 дней`, `21 день`. */
export function dayLabel(days: number): string {
  return `${days} ${russianPlural(days, 'день', 'дня', 'дней')}`
}
