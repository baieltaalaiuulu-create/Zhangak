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
  communityVisibility: boolean
  publicProfileId: string | null
  communityDisplayName: string | null
  communityProfileVisibility: CommunityProfileVisibility
  communityShowXp: boolean
  communityShowAchievements: boolean
  communityShowStreak: boolean
  communityAllowFriendRequests: boolean
  communityDiscoverable: boolean
  profileFrameCode: string
  profileBackgroundCode: string
  profileTitleCode: string
}

export type CommunityProfileVisibility = 'private' | 'community' | 'leaderboard'

export interface CommunitySettings {
  publicProfileId: string
  displayName: string | null
  visibility: CommunityProfileVisibility
  showXp: boolean
  showAchievements: boolean
  showStreak: boolean
  allowFriendRequests: boolean
  discoverable: boolean
}

export interface ProfileCosmetic {
  code: string
  category: 'frame' | 'background' | 'title'
  title: string
  description: string
  rarity: 'base' | 'earned' | 'rare'
}

export interface ProfileAchievementOption {
  id: number
  code: string
  title: string
  description: string
  iconKey: string
  unlockedAt: string
}

export interface ProfileCustomization {
  community: CommunitySettings
  loadout: { frameCode: string; backgroundCode: string; titleCode: string }
  cosmetics: ProfileCosmetic[]
  achievements: ProfileAchievementOption[]
  featuredAchievementIds: number[]
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
  communityVisibility?: boolean
}

export interface CommunitySettingsPatch {
  displayName?: string | null
  visibility?: CommunityProfileVisibility
  showXp?: boolean
  showAchievements?: boolean
  showStreak?: boolean
  allowFriendRequests?: boolean
  discoverable?: boolean
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
  const communityVisibility = profile.communityVisibility === undefined ? true : profile.communityVisibility
  const publicProfileId = profile.publicProfileId === undefined ? null : nullableString(profile.publicProfileId)
  const communityDisplayName = profile.communityDisplayName === undefined ? null : nullableString(profile.communityDisplayName)
  const communityProfileVisibility = profile.communityProfileVisibility === undefined ? (communityVisibility ? 'leaderboard' : 'private') : profile.communityProfileVisibility
  const communityShowXp = profile.communityShowXp === undefined ? true : profile.communityShowXp
  const communityShowAchievements = profile.communityShowAchievements === undefined ? true : profile.communityShowAchievements
  const communityShowStreak = profile.communityShowStreak === undefined ? true : profile.communityShowStreak
  const communityAllowFriendRequests = profile.communityAllowFriendRequests === undefined ? true : profile.communityAllowFriendRequests
  const communityDiscoverable = profile.communityDiscoverable === undefined ? true : profile.communityDiscoverable
  const profileFrameCode = profile.profileFrameCode === undefined ? 'frame_classic' : profile.profileFrameCode
  const profileBackgroundCode = profile.profileBackgroundCode === undefined ? 'background_clear' : profile.profileBackgroundCode
  const profileTitleCode = profile.profileTitleCode === undefined ? 'title_student' : profile.profileTitleCode
  if (typeof profile.id !== 'string'
    || typeof profile.email !== 'string'
    || typeof profile.fullName !== 'string' || profile.fullName.trim() === ''
    || (profile.role !== 'student' && profile.role !== 'math_student')
    || studentType === undefined
    || phone === undefined
    || avatarUrl === undefined
    || !isProfileColor(profileColor)
    || !isDailyStudyGoalMinutes(dailyStudyGoalMinutes)
    || typeof communityVisibility !== 'boolean'
    || publicProfileId === undefined
    || communityDisplayName === undefined
    || (communityProfileVisibility !== 'private' && communityProfileVisibility !== 'community' && communityProfileVisibility !== 'leaderboard')
    || [communityShowXp, communityShowAchievements, communityShowStreak, communityAllowFriendRequests, communityDiscoverable].some(value => typeof value !== 'boolean')
    || [profileFrameCode, profileBackgroundCode, profileTitleCode].some(value => typeof value !== 'string' || !/^[a-z][a-z0-9_]{2,63}$/.test(value))
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
    communityVisibility,
    publicProfileId,
    communityDisplayName,
    communityProfileVisibility,
    communityShowXp: communityShowXp as boolean,
    communityShowAchievements: communityShowAchievements as boolean,
    communityShowStreak: communityShowStreak as boolean,
    communityAllowFriendRequests: communityAllowFriendRequests as boolean,
    communityDiscoverable: communityDiscoverable as boolean,
    profileFrameCode: profileFrameCode as string,
    profileBackgroundCode: profileBackgroundCode as string,
    profileTitleCode: profileTitleCode as string,
  }
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ZhangakApiError(message, 502, 'invalid_response')
  return value as Record<string, unknown>
}

function safeText(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ZhangakApiError(message, 502, 'invalid_response')
  return value
}

function parseCommunitySettings(value: unknown): CommunitySettings {
  const source = record(value, 'Сервис вернул некорректные настройки сообщества')
  const displayName = nullableString(source.displayName)
  if (typeof source.publicProfileId !== 'string' || displayName === undefined
    || !['private', 'community', 'leaderboard'].includes(String(source.visibility))
    || [source.showXp, source.showAchievements, source.showStreak, source.allowFriendRequests, source.discoverable].some(item => typeof item !== 'boolean')) {
    throw new ZhangakApiError('Сервис вернул некорректные настройки сообщества', 502, 'invalid_response')
  }
  return {
    publicProfileId: source.publicProfileId,
    displayName,
    visibility: source.visibility as CommunityProfileVisibility,
    showXp: source.showXp as boolean,
    showAchievements: source.showAchievements as boolean,
    showStreak: source.showStreak as boolean,
    allowFriendRequests: source.allowFriendRequests as boolean,
    discoverable: source.discoverable as boolean,
  }
}

export function parseProfileCustomization(value: unknown): ProfileCustomization {
  const source = record(value, 'Сервис вернул некорректное оформление профиля')
  const loadout = record(source.loadout, 'Сервис вернул некорректное оформление профиля')
  if (!Array.isArray(source.cosmetics) || !Array.isArray(source.achievements) || !Array.isArray(source.featuredAchievementIds)) {
    throw new ZhangakApiError('Сервис вернул некорректное оформление профиля', 502, 'invalid_response')
  }
  const parseCosmetic = (value: unknown): ProfileCosmetic => {
    const item = record(value, 'Сервис вернул некорректное оформление профиля')
    if (!['frame', 'background', 'title'].includes(String(item.category)) || !['base', 'earned', 'rare'].includes(String(item.rarity))) {
      throw new ZhangakApiError('Сервис вернул некорректное оформление профиля', 502, 'invalid_response')
    }
    return { code: safeText(item.code, 'Сервис вернул некорректное оформление профиля'), category: item.category as ProfileCosmetic['category'], title: safeText(item.title, 'Сервис вернул некорректное оформление профиля'), description: safeText(item.description, 'Сервис вернул некорректное оформление профиля'), rarity: item.rarity as ProfileCosmetic['rarity'] }
  }
  const parseAchievement = (value: unknown): ProfileAchievementOption => {
    const item = record(value, 'Сервис вернул некорректные достижения')
    if (!Number.isSafeInteger(item.id) || (item.id as number) < 1 || typeof item.unlockedAt !== 'string') throw new ZhangakApiError('Сервис вернул некорректные достижения', 502, 'invalid_response')
    return { id: item.id as number, code: safeText(item.code, 'Сервис вернул некорректные достижения'), title: safeText(item.title, 'Сервис вернул некорректные достижения'), description: safeText(item.description, 'Сервис вернул некорректные достижения'), iconKey: safeText(item.iconKey, 'Сервис вернул некорректные достижения'), unlockedAt: item.unlockedAt }
  }
  const frameCode = safeText(loadout.frameCode, 'Сервис вернул некорректное оформление профиля')
  const backgroundCode = safeText(loadout.backgroundCode, 'Сервис вернул некорректное оформление профиля')
  const titleCode = safeText(loadout.titleCode, 'Сервис вернул некорректное оформление профиля')
  if (![frameCode, backgroundCode, titleCode].every(code => /^[a-z][a-z0-9_]{2,63}$/.test(code))
    || source.featuredAchievementIds.some(id => !Number.isSafeInteger(id) || (id as number) < 1)
    || new Set(source.featuredAchievementIds).size !== source.featuredAchievementIds.length) {
    throw new ZhangakApiError('Сервис вернул некорректное оформление профиля', 502, 'invalid_response')
  }
  return { community: parseCommunitySettings(source.community), loadout: { frameCode, backgroundCode, titleCode }, cosmetics: source.cosmetics.map(parseCosmetic), achievements: source.achievements.map(parseAchievement), featuredAchievementIds: source.featuredAchievementIds as number[] }
}

export async function getPlatformProfile(): Promise<PlatformProfile> {
  return parsePlatformProfile(await zhangakApiRequest<unknown>('/v1/platform/profile'))
}

export async function updatePlatformProfile(patch: PlatformProfilePatch): Promise<PlatformProfile> {
  const keys = Object.keys(patch)
  if (keys.length === 0 || keys.some(key => !['fullName', 'avatarUrl', 'targetScore', 'profileColor', 'dailyStudyGoalMinutes', 'communityVisibility'].includes(key))) {
    throw new Error('Некорректные данные профиля')
  }
  return parsePlatformProfile(await zhangakApiJson<unknown>('/v1/platform/profile', 'PATCH', patch))
}

export async function getProfileCustomization(): Promise<ProfileCustomization> {
  return parseProfileCustomization(await zhangakApiRequest<unknown>('/v1/platform/profile/customization'))
}

export async function updateCommunitySettings(patch: CommunitySettingsPatch): Promise<CommunitySettings> {
  const allowed = ['displayName', 'visibility', 'showXp', 'showAchievements', 'showStreak', 'allowFriendRequests', 'discoverable']
  if (Object.keys(patch).length === 0 || Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Некорректные настройки сообщества')
  const source = record(await zhangakApiJson<unknown>('/v1/platform/profile/community', 'PATCH', patch), 'Сервис вернул некорректные настройки сообщества')
  return parseCommunitySettings(source.community)
}

export async function updateProfileLoadout(loadout: ProfileCustomization['loadout']): Promise<ProfileCustomization['loadout']> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/profile/loadout', 'PATCH', loadout), 'Сервис вернул некорректное оформление профиля')
  const value = record(source.loadout, 'Сервис вернул некорректное оформление профиля')
  const result = { frameCode: safeText(value.frameCode, 'Сервис вернул некорректное оформление профиля'), backgroundCode: safeText(value.backgroundCode, 'Сервис вернул некорректное оформление профиля'), titleCode: safeText(value.titleCode, 'Сервис вернул некорректное оформление профиля') }
  if (!Object.values(result).every(code => /^[a-z][a-z0-9_]{2,63}$/.test(code))) throw new ZhangakApiError('Сервис вернул некорректное оформление профиля', 502, 'invalid_response')
  return result
}

export async function updateFeaturedAchievements(achievementIds: number[]): Promise<number[]> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/profile/featured-achievements', 'PATCH', { achievementIds }), 'Сервис вернул некорректные достижения')
  if (!Array.isArray(source.featuredAchievementIds) || source.featuredAchievementIds.some(id => !Number.isSafeInteger(id) || (id as number) < 1)) throw new ZhangakApiError('Сервис вернул некорректные достижения', 502, 'invalid_response')
  return source.featuredAchievementIds as number[]
}
