'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type QuestPeriod = 'daily' | 'weekly'
export type QuestEvent = 'platform_visit' | 'lesson_completed' | 'practice_submitted' | 'daily_challenge_completed' | 'trainer_mastered' | 'daily_quest_completed' | 'weekly_quest_completed'

export interface AdminQuestConfiguration {
  effectiveFrom: string
  targetCount: number
  xpReward: number
  isActive: boolean
}

export interface AdminQuestDefinition {
  id: number
  code: string
  period: QuestPeriod
  targetEventType: QuestEvent
  title: string
  description: string
  sortOrder: number
  current: AdminQuestConfiguration
  scheduled: AdminQuestConfiguration | null
}

export interface AdminAchievementDefinition {
  id: number
  code: string
  title: string
  description: string
  iconKey: string
  sortOrder: number
  isActive: boolean
}

export interface AdminGamificationDefinitions {
  quests: AdminQuestDefinition[]
  achievements: AdminAchievementDefinition[]
}

function invalid(context: string): never {
  throw new Error(`Некорректный ответ сервиса: ${context}`)
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(context)
  return value as Record<string, unknown>
}

function text(value: unknown, context: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(context)
  return value.trim()
}

function integer(value: unknown, context: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) invalid(context)
  return value as number
}

function date(value: unknown, context: string): string {
  const result = text(value, context, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalid(context)
  return result
}

function bool(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') invalid(context)
  return value
}

function configuration(value: unknown, context: string): AdminQuestConfiguration {
  const source = record(value, context)
  return {
    effectiveFrom: date(source.effectiveFrom, `${context}: дата`),
    targetCount: integer(source.targetCount, `${context}: цель`, 1, 1000),
    xpReward: integer(source.xpReward, `${context}: XP`, 1, 10_000),
    isActive: bool(source.isActive, `${context}: статус`),
  }
}

function quest(value: unknown): AdminQuestDefinition {
  const source = record(value, 'квест')
  const period = source.period
  if (period !== 'daily' && period !== 'weekly') invalid('период квеста')
  const event = source.targetEventType
  const allowedEvents: QuestEvent[] = ['platform_visit', 'lesson_completed', 'practice_submitted', 'daily_challenge_completed', 'trainer_mastered', 'daily_quest_completed', 'weekly_quest_completed']
  if (typeof event !== 'string' || !allowedEvents.includes(event as QuestEvent)) invalid('событие квеста')
  const scheduled = source.scheduled === null ? null : configuration(source.scheduled, 'запланированный квест')
  return {
    id: integer(source.id, 'id квеста', 1, Number.MAX_SAFE_INTEGER),
    code: text(source.code, 'код квеста', 64),
    period,
    targetEventType: event as QuestEvent,
    title: text(source.title, 'название квеста', 160),
    description: text(source.description, 'описание квеста', 500),
    sortOrder: integer(source.sortOrder, 'порядок квеста', 0, 10_000),
    current: configuration(source.current, 'текущий квест'),
    scheduled,
  }
}

function achievement(value: unknown): AdminAchievementDefinition {
  const source = record(value, 'достижение')
  return {
    id: integer(source.id, 'id достижения', 1, Number.MAX_SAFE_INTEGER),
    code: text(source.code, 'код достижения', 64),
    title: text(source.title, 'название достижения', 160),
    description: text(source.description, 'описание достижения', 500),
    iconKey: text(source.iconKey, 'иконка достижения', 64),
    sortOrder: integer(source.sortOrder, 'порядок достижения', 0, 10_000),
    isActive: bool(source.isActive, 'статус достижения'),
  }
}

export function parseAdminGamificationDefinitions(value: unknown): AdminGamificationDefinitions {
  const source = record(value, 'настройки геймификации')
  if (!Array.isArray(source.quests) || !Array.isArray(source.achievements)) invalid('списки геймификации')
  const quests = source.quests.map(quest)
  const achievements = source.achievements.map(achievement)
  if (new Set(quests.map(item => item.id)).size !== quests.length || new Set(achievements.map(item => item.id)).size !== achievements.length) {
    invalid('повторяющиеся настройки')
  }
  return { quests, achievements }
}

export async function getAdminGamificationDefinitions(): Promise<AdminGamificationDefinitions> {
  return parseAdminGamificationDefinitions(await zhangakApiRequest<unknown>('/v1/admin/gamification/definitions'))
}

export async function scheduleAdminQuestConfiguration(id: number, input: Omit<AdminQuestConfiguration, 'effectiveFrom'>): Promise<AdminQuestDefinition> {
  const body = {
    targetCount: integer(input.targetCount, 'цель квеста', 1, 1000),
    xpReward: integer(input.xpReward, 'награда квеста', 1, 10_000),
    isActive: bool(input.isActive, 'статус квеста'),
  }
  const response = record(await zhangakApiJson<unknown>(`/v1/admin/gamification/quests/${integer(id, 'id квеста', 1, Number.MAX_SAFE_INTEGER)}`, 'PATCH', body), 'запланированный квест')
  return quest(response.definition)
}

export async function updateAdminAchievementDefinition(id: number, input: Pick<AdminAchievementDefinition, 'isActive' | 'sortOrder'>): Promise<AdminAchievementDefinition> {
  const body = {
    isActive: bool(input.isActive, 'статус достижения'),
    sortOrder: integer(input.sortOrder, 'порядок достижения', 0, 10_000),
  }
  const response = record(await zhangakApiJson<unknown>(`/v1/admin/gamification/achievements/${integer(id, 'id достижения', 1, Number.MAX_SAFE_INTEGER)}`, 'PATCH', body), 'обновлённое достижение')
  return achievement(response.achievement)
}
