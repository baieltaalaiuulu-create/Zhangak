'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface QuestProgress {
  progressId: number | null
  code: string
  period: 'daily' | 'weekly'
  title: string
  description: string
  targetCount: number
  currentCount: number
  xpReward: number
  claimable: boolean
  completedAt: string | null
  periodEnd: string
}

export interface CommunityAchievement {
  code: string
  title: string
  description: string
  iconKey: string
  unlockedAt: string
}

export interface GamificationSummary {
  xp: number
  level: number
  levelStartXp: number
  levelEndXp: number
  streak: number
  activity: { lessonsCompleted: number; trainerMastered: number; dailyChallenges: number }
  pendingQuestRewards: number
  quests: QuestProgress[]
  achievements: CommunityAchievement[]
}

export interface LeaderboardItem {
  rank: number
  publicProfileId: string
  displayName: string
  xp: number
  isMe: boolean
  profileColor: 'blue' | 'violet' | 'emerald' | 'rose'
  frameCode: string
  backgroundCode: string
  titleCode: string
}

export interface LeaderboardResponse {
  scope: 'overall'
  items: LeaderboardItem[]
  me: Omit<LeaderboardItem, 'isMe'> | null
}

export interface CommunityProfile {
  publicProfileId: string
  displayName: string
  profileColor: 'blue' | 'violet' | 'emerald' | 'rose'
  frameCode: string
  backgroundCode: string
  titleCode: string
  xp: number | null
  level: number | null
  streak: number | null
  isMe: boolean
  achievements: CommunityAchievement[]
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ: ${context}`)
  return value as Record<string, unknown>
}

function nonNegative(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Некорректный ответ: ${context}`)
  return value as number
}

function positive(value: unknown, context: string): number {
  const parsed = nonNegative(value, context)
  if (parsed < 1) throw new Error(`Некорректный ответ: ${context}`)
  return parsed
}

function text(value: unknown, context: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Некорректный ответ: ${context}`)
  return value
}

function achievement(value: unknown): CommunityAchievement {
  const source = record(value, 'достижение')
  if (typeof source.unlockedAt !== 'string') throw new Error('Некорректный ответ: дата достижения')
  return {
    code: text(source.code, 'код достижения'),
    title: text(source.title, 'название достижения'),
    description: text(source.description, 'описание достижения'),
    iconKey: text(source.iconKey, 'иконка достижения'),
    unlockedAt: source.unlockedAt,
  }
}

function quest(value: unknown): QuestProgress {
  const source = record(value, 'квест')
  if (source.period !== 'daily' && source.period !== 'weekly') throw new Error('Некорректный ответ: период квеста')
  if (source.completedAt !== null && typeof source.completedAt !== 'string') throw new Error('Некорректный ответ: завершение квеста')
  return {
    progressId: source.progressId === null ? null : positive(source.progressId, 'id прогресса квеста'),
    code: text(source.code, 'код квеста'),
    period: source.period,
    title: text(source.title, 'название квеста'),
    description: text(source.description, 'описание квеста'),
    targetCount: nonNegative(source.targetCount, 'цель квеста'),
    currentCount: nonNegative(source.currentCount, 'прогресс квеста'),
    xpReward: nonNegative(source.xpReward, 'награда квеста'),
    claimable: source.claimable === true,
    completedAt: source.completedAt,
    periodEnd: text(source.periodEnd, 'срок квеста'),
  }
}

export function parseGamificationSummary(value: unknown): GamificationSummary {
  const source = record(value, 'сводка геймификации')
  if (!Array.isArray(source.quests) || !Array.isArray(source.achievements)) throw new Error('Некорректный ответ: списки геймификации')
  const activity = record(source.activity, 'активность')
  const xp = nonNegative(source.xp, 'XP')
  const level = nonNegative(source.level, 'уровень')
  const levelStartXp = nonNegative(source.levelStartXp, 'начало уровня')
  const levelEndXp = nonNegative(source.levelEndXp, 'конец уровня')
  if (level < 1 || levelEndXp <= levelStartXp || xp < levelStartXp) throw new Error('Некорректный ответ: уровень')
  return {
    xp, level, levelStartXp, levelEndXp,
    streak: nonNegative(source.streak, 'серия'),
    activity: {
      lessonsCompleted: nonNegative(activity.lessonsCompleted, 'уроки'),
      trainerMastered: nonNegative(activity.trainerMastered, 'вопросы тренажёра'),
      dailyChallenges: nonNegative(activity.dailyChallenges, 'задания дня'),
    },
    pendingQuestRewards: nonNegative(source.pendingQuestRewards, 'награды квестов'),
    quests: source.quests.map(quest),
    achievements: source.achievements.map(achievement),
  }
}

function leaderboardItem(value: unknown, allowMe: boolean): LeaderboardItem {
  const source = record(value, 'участник рейтинга')
  if (typeof source.isMe !== 'boolean' && allowMe) throw new Error('Некорректный ответ: участник рейтинга')
  const profileColor = String(source.profileColor ?? 'blue')
  const frameCode = String(source.frameCode ?? 'frame_classic')
  const backgroundCode = String(source.backgroundCode ?? 'background_clear')
  const titleCode = String(source.titleCode ?? 'title_student')
  if (!['blue', 'violet', 'emerald', 'rose'].includes(profileColor)
    || ![frameCode, backgroundCode, titleCode].every(code => /^[a-z][a-z0-9_]{2,63}$/.test(code))) {
    throw new Error('Некорректный ответ: оформление участника')
  }
  return {
    rank: positive(source.rank, 'место'),
    publicProfileId: text(source.publicProfileId, 'публичный профиль'),
    displayName: text(source.displayName, 'имя участника'),
    xp: nonNegative(source.xp, 'XP участника'),
    isMe: allowMe ? source.isMe as boolean : false,
    profileColor: profileColor as LeaderboardItem['profileColor'], frameCode, backgroundCode, titleCode,
  }
}

export function parseLeaderboard(value: unknown): LeaderboardResponse {
  const source = record(value, 'рейтинг')
  if (source.scope !== 'overall' || !Array.isArray(source.items)) throw new Error('Некорректный ответ: рейтинг')
  const me = source.me === null ? null : leaderboardItem(source.me, false)
  return { scope: 'overall', items: source.items.map(item => leaderboardItem(item, true)), me }
}

function parseCommunityProfile(value: unknown): CommunityProfile {
  const source = record(value, 'публичный профиль')
  const profile = record(source.profile, 'публичный профиль')
  if (!['blue', 'violet', 'emerald', 'rose'].includes(String(profile.profileColor)) || !Array.isArray(profile.achievements)) throw new Error('Некорректный ответ: публичный профиль')
  const xp = profile.xp === null ? null : nonNegative(profile.xp, 'XP')
  const level = profile.level === null ? null : nonNegative(profile.level, 'уровень')
  const streak = profile.streak === null ? null : nonNegative(profile.streak, 'серия')
  const frameCode = text(profile.frameCode ?? 'frame_classic', 'рамка')
  const backgroundCode = text(profile.backgroundCode ?? 'background_clear', 'фон')
  const titleCode = text(profile.titleCode ?? 'title_student', 'титул')
  if ((level !== null && level < 1)
    || ![frameCode, backgroundCode, titleCode].every(code => /^[a-z][a-z0-9_]{2,63}$/.test(code))
    || typeof profile.isMe !== 'boolean') throw new Error('Некорректный ответ: уровень')
  return {
    publicProfileId: text(profile.publicProfileId, 'публичный профиль'),
    displayName: text(profile.displayName, 'имя участника'),
    profileColor: profile.profileColor as CommunityProfile['profileColor'],
    frameCode, backgroundCode, titleCode,
    xp,
    level,
    streak,
    isMe: profile.isMe,
    achievements: profile.achievements.map(achievement),
  }
}

export async function getGamificationSummary(): Promise<GamificationSummary> {
  const source = record(await zhangakApiRequest<unknown>('/v1/platform/gamification/summary'), 'геймификация')
  return parseGamificationSummary(source.summary)
}

export async function checkInGamification(): Promise<{ recorded: boolean; summary: GamificationSummary; achievements: string[] }> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/gamification/check-in', 'POST', {}), 'чек-ин')
  if (typeof source.recorded !== 'boolean' || !Array.isArray(source.achievements) || source.achievements.some(value => typeof value !== 'string')) {
    throw new Error('Некорректный ответ: чек-ин')
  }
  return { recorded: source.recorded, summary: parseGamificationSummary(source.summary), achievements: source.achievements as string[] }
}

export async function claimQuestReward(progressId: number): Promise<{ summary: GamificationSummary; claimed: boolean; achievements: string[] }> {
  const source = record(await zhangakApiJson<unknown>(`/v1/platform/gamification/quests/${progressId}/claim`, 'POST', {}), 'награда квеста')
  const claim = record(source.claim, 'результат награды')
  if (!['claimed', 'already_claimed'].includes(String(claim.state)) || !Array.isArray(claim.achievements ?? [])) throw new Error('Некорректный ответ: награда квеста')
  return { summary: parseGamificationSummary(source.summary), claimed: claim.state === 'claimed', achievements: (claim.achievements ?? []) as string[] }
}

export async function getOverallLeaderboard(): Promise<LeaderboardResponse> {
  return parseLeaderboard(await zhangakApiRequest<unknown>('/v1/platform/leaderboard'))
}

export async function getCommunityProfile(publicProfileId: string): Promise<CommunityProfile> {
  return parseCommunityProfile(await zhangakApiRequest<unknown>(`/v1/platform/community/profiles/${encodeURIComponent(publicProfileId)}`))
}
