export type ProbabilityLevel = 'high' | 'medium' | 'low' | 'unknown'

export interface AdmissionProbability {
  level: ProbabilityLevel
  label: string
  pointsNeeded: number
}

export interface AdmissionCandidate {
  id: string
  name: string
  minScore: number | null
  rating: number
}

export function getAdmissionProbability(
  studentScore: number | null,
  minScore: number | null,
): AdmissionProbability {
  if (studentScore == null || studentScore <= 0) {
    return { level: 'unknown', label: 'Нужен результат пробного ОРТ', pointsNeeded: 0 }
  }
  if (minScore == null || minScore <= 0) {
    return { level: 'unknown', label: 'Проходной балл не указан', pointsNeeded: 0 }
  }
  if (studentScore >= minScore + 20) {
    return { level: 'high', label: 'Высокая вероятность', pointsNeeded: 0 }
  }
  if (studentScore >= minScore) {
    return { level: 'medium', label: 'Средняя вероятность', pointsNeeded: 0 }
  }
  return { level: 'low', label: 'Низкая вероятность', pointsNeeded: minScore - studentScore }
}

const LEVEL_ORDER: Record<ProbabilityLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  unknown: 3,
}

export function rankAdmissionMatches<T extends AdmissionCandidate>(
  candidates: T[],
  studentScore: number | null,
  limit = 3,
): T[] {
  return [...candidates]
    .sort((a, b) => {
      const aProbability = getAdmissionProbability(studentScore, a.minScore)
      const bProbability = getAdmissionProbability(studentScore, b.minScore)
      return LEVEL_ORDER[aProbability.level] - LEVEL_ORDER[bProbability.level]
        || aProbability.pointsNeeded - bProbability.pointsNeeded
        || b.rating - a.rating
        || a.name.localeCompare(b.name, 'ru')
    })
    .slice(0, Math.max(0, limit))
}
