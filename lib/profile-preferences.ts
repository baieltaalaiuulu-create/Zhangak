/**
 * Values shared by the student profile API client and its presentation
 * components.  These are deliberately a small, closed set: the server
 * validates the same identifiers and never accepts arbitrary CSS values.
 */
export const PROFILE_COLOR_IDS = ['blue', 'violet', 'emerald', 'rose'] as const

export type ProfileColor = typeof PROFILE_COLOR_IDS[number]

export const DEFAULT_PROFILE_COLOR: ProfileColor = 'blue'

export const PROFILE_COLOR_OPTIONS: Readonly<Record<ProfileColor, {
  label: string
  color: string
  softColor: string
}>> = {
  blue: { label: 'Синий', color: '#1B3F92', softColor: '#EEF2FF' },
  violet: { label: 'Фиолетовый', color: '#6C3DE0', softColor: '#F3E8FF' },
  emerald: { label: 'Зелёный', color: '#059669', softColor: '#ECFDF5' },
  rose: { label: 'Розовый', color: '#E11D48', softColor: '#FFF1F2' },
}

export const DAILY_STUDY_GOAL_MINUTES = [15, 30, 45, 60, 90] as const

export type DailyStudyGoalMinutes = typeof DAILY_STUDY_GOAL_MINUTES[number]

export const DEFAULT_DAILY_STUDY_GOAL_MINUTES: DailyStudyGoalMinutes = 30

export function isProfileColor(value: unknown): value is ProfileColor {
  return typeof value === 'string' && (PROFILE_COLOR_IDS as readonly string[]).includes(value)
}

export function isDailyStudyGoalMinutes(value: unknown): value is DailyStudyGoalMinutes {
  return typeof value === 'number' && (DAILY_STUDY_GOAL_MINUTES as readonly number[]).includes(value)
}
