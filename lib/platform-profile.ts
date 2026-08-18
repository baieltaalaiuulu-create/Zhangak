'use client'

import { ZhangakApiError, zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'
import {
  DEFAULT_DAILY_STUDY_GOAL_MINUTES,
  DEFAULT_PROFILE_COLOR,
  isDailyStudyGoalMinutes,
  isProfileColor,
  type DailyStudyGoalMinutes,
  type ProfileColor,
} from './profile-preferences.ts'

export const DEFAULT_TARGET_SCORE = 180
export const MIN_TARGET_SCORE = 100
export const MAX_TARGET_SCORE = 245

export interface PlatformProfile {
  id: string
  email: string
  fullName: string
  role: 'student' | 'math_student'
  studentType: string | null
  phone: string | null
  targetScore: number | null
  avatarUrl: string | null
  profileColor: ProfileColor
  dailyStudyGoalMinutes: DailyStudyGoalMinutes
}

export interface ProfileScorePoint {
  score: number
  completedAt: string
}

export interface PlatformProfilePatch {
  fullName?: string
  avatarUrl?: string | null
  targetScore?: number
  profileColor?: ProfileColor
  dailyStudyGoalMinutes?: DailyStudyGoalMinutes
}

function invalidResponse(): never {
  throw new ZhangakApiError('Сервис вернул некорректный профиль', 502, 'invalid_response')
}

function nullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined
}

export function parsePlatformProfile(value: unknown): PlatformProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse()
  const payload = value as { profile?: unknown }
  if (!payload.profile || typeof payload.profile !== 'object' || Array.isArray(payload.profile)) return invalidResponse()
  const profile = payload.profile as Record<string, unknown>
  const studentType = nullableString(profile.studentType)
  const phone = nullableString(profile.phone)
  const avatarUrl = nullableString(profile.avatarUrl)
  const targetScore = profile.targetScore
  // Defaults keep a client rollout compatible with an already-running API
  // while the accompanying database migration is being applied. Once the
  // current API is live these values are always explicitly projected.
  const profileColor = profile.profileColor === undefined ? DEFAULT_PROFILE_COLOR : profile.profileColor
  const dailyStudyGoalMinutes = profile.dailyStudyGoalMinutes === undefined
    ? DEFAULT_DAILY_STUDY_GOAL_MINUTES
    : profile.dailyStudyGoalMinutes
  if (typeof profile.id !== 'string'
    || typeof profile.email !== 'string'
    || typeof profile.fullName !== 'string' || profile.fullName.trim() === ''
    || (profile.role !== 'student' && profile.role !== 'math_student')
    || studentType === undefined
    || phone === undefined
    || avatarUrl === undefined
    || !isProfileColor(profileColor)
    || !isDailyStudyGoalMinutes(dailyStudyGoalMinutes)
    || (targetScore !== null && (typeof targetScore !== 'number'
      || !Number.isSafeInteger(targetScore)
      || targetScore < 0
      || targetScore > MAX_TARGET_SCORE))) {
    return invalidResponse()
  }
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    studentType,
    phone,
    targetScore,
    avatarUrl,
    profileColor,
    dailyStudyGoalMinutes,
  }
}

export async function getPlatformProfile(): Promise<PlatformProfile> {
  return parsePlatformProfile(await zhangakApiRequest<unknown>('/v1/platform/profile'))
}

export async function updatePlatformProfile(patch: PlatformProfilePatch): Promise<PlatformProfile> {
  const keys = Object.keys(patch)
  if (keys.length === 0 || keys.some(key => !['fullName', 'avatarUrl', 'targetScore', 'profileColor', 'dailyStudyGoalMinutes'].includes(key))) {
    throw new Error('Некорректные данные профиля')
  }
  return parsePlatformProfile(await zhangakApiJson<unknown>('/v1/platform/profile', 'PATCH', patch))
}
