'use client'

import { zhangakApiRequest } from './zhangak-api-client.ts'

export type RoadmapAccentColor = 'green' | 'blue' | 'violet' | 'red'
export type RoadmapLessonState = 'done' | 'locked' | 'available' | 'current'

export interface PlatformRoadmapLesson {
  id: string
  apiId: number
  lessonNumber: number
  title: string
  description: string | null
  subject: string | null
  section: string | null
  topic: string | null
  durationMinutes: number | null
  isTest: boolean
  completionMode: 'self' | 'practice'
  completionPercent: number
  completedAt: string | null
  isLocked: boolean
  state: RoadmapLessonState
  isCurrent: boolean
}

export interface PlatformRoadmapUnit {
  id: string
  apiId: number
  unitNumber: number
  title: string
  description: string | null
  accentColor: RoadmapAccentColor
  completedLessons: number
  lessonCount: number
  completionPercent: number
  starCount: 0 | 1 | 2 | 3
  lessons: PlatformRoadmapLesson[]
}

export interface PlatformRoadmap {
  course: { id: number; name: string; code: string | null; subject: string | null } | null
  direction: 'bottom_to_top'
  units: PlatformRoadmapUnit[]
  summary: { completedLessons: number; lessonCount: number; completionPercent: number }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ: ${label}`)
  return value as Record<string, unknown>
}

function positive(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`Некорректный ${label}`)
  return value
}

function nonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Некорректный ${label}`)
  return value
}

function percent(value: unknown, label: string): number {
  const parsed = nonNegative(value, label)
  if (parsed > 100) throw new Error(`Некорректный ${label}`)
  return parsed
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Некорректный ${label}`)
  return value.trim()
}

function optionalText(value: unknown, label: string): string | null {
  if (value == null) return null
  return text(value, label)
}

function nullableIsoDate(value: unknown, label: string): string | null {
  if (value == null) return null
  const iso = text(value, label)
  if (Number.isNaN(Date.parse(iso))) throw new Error(`Некорректный ${label}`)
  return iso
}

function accentColor(value: unknown): RoadmapAccentColor {
  if (value === 'green' || value === 'blue' || value === 'violet' || value === 'red') return value
  throw new Error('Некорректный цвет раздела')
}

function lessonState(value: unknown): RoadmapLessonState {
  if (value === 'done' || value === 'locked' || value === 'available' || value === 'current') return value
  throw new Error('Некорректный статус урока')
}

function completionMode(value: unknown): 'self' | 'practice' {
  if (value === 'self' || value === 'practice') return value
  throw new Error('Некорректный способ завершения')
}

function parseRoadmapLesson(value: unknown): PlatformRoadmapLesson {
  const source = record(value, 'урок дорожной карты')
  const apiId = positive(source.id, 'идентификатор урока')
  const state = lessonState(source.state)
  const isLocked = source.isLocked === true
  if (state === 'locked' !== isLocked) throw new Error('Несогласованный статус урока')
  if (typeof source.isTest !== 'boolean' || typeof source.isCurrent !== 'boolean') throw new Error('Некорректные параметры урока')
  const durationMinutes = source.durationMinutes == null ? null : positive(source.durationMinutes, 'длительность урока')
  const completionPercent = percent(source.completionPercent, 'прогресс урока')
  const completedAt = nullableIsoDate(source.completedAt, 'дата завершения урока')
  if (state === 'done' !== (completedAt !== null)) throw new Error('Несогласованный прогресс урока')
  return {
    id: String(apiId), apiId, lessonNumber: positive(source.lessonNumber, 'номер урока'), title: text(source.title, 'название урока'),
    description: optionalText(source.description, 'описание урока'), subject: optionalText(source.subject, 'предмет урока'),
    section: optionalText(source.section, 'раздел урока'), topic: optionalText(source.topic, 'тема урока'), durationMinutes,
    isTest: source.isTest, completionMode: completionMode(source.completionMode), completionPercent, completedAt,
    isLocked, state, isCurrent: source.isCurrent,
  }
}

function parseRoadmapUnit(value: unknown): PlatformRoadmapUnit {
  const source = record(value, 'раздел дорожной карты')
  if (!Array.isArray(source.lessons)) throw new Error('Некорректные уроки раздела')
  const lessonCount = nonNegative(source.lessonCount, 'количество уроков раздела')
  const completedLessons = nonNegative(source.completedLessons, 'пройденные уроки раздела')
  if (completedLessons > lessonCount || source.lessons.length !== lessonCount) throw new Error('Несогласованный прогресс раздела')
  if (source.starCount !== 0 && source.starCount !== 1 && source.starCount !== 2 && source.starCount !== 3) throw new Error('Некорректные звёзды раздела')
  return {
    id: String(positive(source.id, 'идентификатор раздела')), apiId: positive(source.id, 'идентификатор раздела'),
    unitNumber: positive(source.unitNumber, 'номер раздела'), title: text(source.title, 'название раздела'),
    description: optionalText(source.description, 'описание раздела'), accentColor: accentColor(source.accentColor),
    completedLessons, lessonCount, completionPercent: percent(source.completionPercent, 'прогресс раздела'),
    starCount: source.starCount, lessons: source.lessons.map(parseRoadmapLesson),
  }
}

export function parsePlatformRoadmap(value: unknown): PlatformRoadmap {
  const source = record(value, 'дорожная карта')
  if (source.direction !== 'bottom_to_top') throw new Error('Некорректное направление дорожной карты')
  if (!Array.isArray(source.units)) throw new Error('Некорректные разделы дорожной карты')
  const summary = record(source.summary, 'сводка дорожной карты')
  const courseSource = source.course == null ? null : record(source.course, 'курс дорожной карты')
  const course = courseSource === null ? null : {
    id: positive(courseSource.id, 'идентификатор курса'), name: text(courseSource.name, 'название курса'),
    code: optionalText(courseSource.code, 'код курса'), subject: optionalText(courseSource.subject, 'предмет курса'),
  }
  const units = source.units.map(parseRoadmapUnit)
  const lessonCount = nonNegative(summary.lessonCount, 'количество уроков')
  const completedLessons = nonNegative(summary.completedLessons, 'пройденные уроки')
  if (completedLessons > lessonCount || units.reduce((total, unit) => total + unit.lessonCount, 0) !== lessonCount) {
    throw new Error('Несогласованная сводка дорожной карты')
  }
  return {
    course, direction: 'bottom_to_top', units,
    summary: { completedLessons, lessonCount, completionPercent: percent(summary.completionPercent, 'общий прогресс') },
  }
}

export async function fetchPlatformRoadmap(): Promise<PlatformRoadmap> {
  return parsePlatformRoadmap(await zhangakApiRequest<unknown>('/v1/platform/roadmap'))
}
