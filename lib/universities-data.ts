'use client'

import { ZhangakApiError, zhangakApiRequest } from './zhangak-api-client.ts'

export { getAdmissionProbability as getProbability } from './university-matching.ts'
export type { AdmissionProbability as Probability, ProbabilityLevel } from './university-matching.ts'

// The university catalog is now read only through the first-party BFF. It
// deliberately has no fallback to the retired catalog: an empty own
// catalog is shown as an honest "being populated" state, never as invented
// university facts.

export type UniversityType = 'state' | 'private'
export type City = string
export type Direction = 'it' | 'medicine' | 'economics' | 'law' | 'pedagogy'
export type StudyLanguage = 'ru' | 'kg' | 'tr' | 'en'
export type CatalogStatus = 'ready' | 'empty'

export const DIRECTION_LABELS: Record<Direction, string> = {
  it: 'IT и технологии',
  medicine: 'Медицина',
  economics: 'Экономика',
  law: 'Право',
  pedagogy: 'Педагогика',
}

export const LANGUAGE_LABELS: Record<StudyLanguage, string> = {
  ru: 'Русский',
  kg: 'Кыргызский',
  tr: 'Турецкий',
  en: 'Английский',
}

export const GENERIC_ADMISSION_DOCUMENTS = [
  'Аттестат о среднем образовании (оригинал)',
  'Сертификат ОРТ',
  'Копия паспорта / свидетельства о рождении',
  '6 фотографий 3×4',
  'Медицинская справка формы 086/у',
  'Заявление на имя ректора',
]

export const GENERIC_ADMISSION_DEADLINE = 'Точные сроки приёма пока не загружены. Проверь актуальные даты на официальном сайте университета или в его приёмной комиссии.'

export interface Specialty {
  id: string
  name: string
  faculty: string
  minScore: number | null
  costPerYear: number | null
  language: string
  form: string
  type: string
}

export interface Advantage {
  iconKey: 'education' | 'international' | 'career' | 'campus'
  title: string
  description: string
}

export interface University {
  id: string
  name: string
  shortName: string
  logoUrl: string | null
  city: City
  type: UniversityType
  minScore: number | null
  avgScore: number | null
  costFrom: number | null
  costMax: number | null
  specialtyCount: number
  rating: number
  description: string
  about: string[]
  advantages: Advantage[]
  hasDormitory: boolean
  budgetSeats: boolean
  directions: Direction[]
  languages: StudyLanguage[]
  website: string
  specialties: Specialty[]
  documents: string[]
  applicationDeadline: string
}

export interface CatalogStats {
  totalUniversities: number
  totalSpecialties: number
  stateUniversities: number
  privateUniversities: number
  averagePassingScore: number
}

export interface UniversityCatalog {
  items: University[]
  stats: CatalogStats
  catalogStatus: CatalogStatus
}

type ApiRecord = Record<string, unknown>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DIRECTIONS = new Set<Direction>(['it', 'medicine', 'economics', 'law', 'pedagogy'])
const LANGUAGES = new Set<StudyLanguage>(['ru', 'kg', 'tr', 'en'])
const ADVANTAGE_ICONS = new Set<Advantage['iconKey']>(['education', 'international', 'career', 'campus'])

function record(value: unknown, label: string): ApiRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректные данные каталога: ${label}`)
  return value as ApiRecord
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Некорректные данные каталога: ${label}`)
  return value
}

function optionalText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Некорректные данные каталога: ${label}`)
  return value
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null
  return optionalText(value, label)
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Некорректные данные каталога: ${label}`)
  return value
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Некорректные данные каталога: ${label}`)
  return value
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Некорректные данные каталога: ${label}`)
  return value
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Некорректные данные каталога: ${label}`)
  return value
}

function parseSpecialty(value: unknown): Specialty {
  const item = record(value, 'specialty')
  return {
    id: requiredText(item.id, 'specialty.id'),
    name: requiredText(item.name, 'specialty.name'),
    faculty: optionalText(item.faculty, 'specialty.faculty'),
    minScore: nullableNumber(item.minScore, 'specialty.minScore'),
    costPerYear: nullableNumber(item.costPerYear, 'specialty.costPerYear'),
    language: optionalText(item.language, 'specialty.language'),
    form: requiredText(item.form, 'specialty.form'),
    type: requiredText(item.type, 'specialty.type'),
  }
}

function parseAdvantage(value: unknown): Advantage {
  const item = record(value, 'advantage')
  if (typeof item.iconKey !== 'string' || !ADVANTAGE_ICONS.has(item.iconKey as Advantage['iconKey'])) {
    throw new Error('Некорректные данные каталога: advantage.iconKey')
  }
  return {
    iconKey: item.iconKey as Advantage['iconKey'],
    title: requiredText(item.title, 'advantage.title'),
    description: optionalText(item.description, 'advantage.description'),
  }
}

function parseDirection(value: unknown): Direction {
  if (typeof value !== 'string' || !DIRECTIONS.has(value as Direction)) throw new Error('Некорректные данные каталога: direction')
  return value as Direction
}

function parseLanguage(value: unknown): StudyLanguage {
  if (typeof value !== 'string' || !LANGUAGES.has(value as StudyLanguage)) throw new Error('Некорректные данные каталога: language')
  return value as StudyLanguage
}

function parseUniversity(value: unknown): University {
  const item = record(value, 'university')
  if (item.type !== 'state' && item.type !== 'private') throw new Error('Некорректные данные каталога: university.type')
  const website = optionalText(item.website, 'university.website')
  return {
    id: requiredText(item.id, 'university.id'),
    name: requiredText(item.name, 'university.name'),
    shortName: requiredText(item.shortName, 'university.shortName'),
    logoUrl: nullableText(item.logoUrl, 'university.logoUrl'),
    city: requiredText(item.city, 'university.city'),
    type: item.type,
    minScore: nullableNumber(item.minScore, 'university.minScore'),
    avgScore: nullableNumber(item.avgScore, 'university.avgScore'),
    costFrom: nullableNumber(item.costFrom, 'university.costFrom'),
    costMax: nullableNumber(item.costMax, 'university.costMax'),
    specialtyCount: nonNegativeInteger(item.specialtyCount, 'university.specialtyCount'),
    rating: nullableNumber(item.rating, 'university.rating') ?? 0,
    description: optionalText(item.description, 'university.description'),
    about: array(item.about, 'university.about').map((paragraph, index) => optionalText(paragraph, `university.about.${index}`)),
    advantages: array(item.advantages, 'university.advantages').map(parseAdvantage),
    hasDormitory: boolean(item.hasDormitory, 'university.hasDormitory'),
    budgetSeats: boolean(item.budgetSeats, 'university.budgetSeats'),
    directions: array(item.directions, 'university.directions').map(parseDirection),
    languages: array(item.languages, 'university.languages').map(parseLanguage),
    website,
    specialties: array(item.specialties, 'university.specialties').map(parseSpecialty),
    documents: GENERIC_ADMISSION_DOCUMENTS,
    applicationDeadline: GENERIC_ADMISSION_DEADLINE,
  }
}

function parseStats(value: unknown): CatalogStats {
  const stats = record(value, 'stats')
  return {
    totalUniversities: nonNegativeInteger(stats.totalUniversities, 'stats.totalUniversities'),
    totalSpecialties: nonNegativeInteger(stats.totalSpecialties, 'stats.totalSpecialties'),
    stateUniversities: nonNegativeInteger(stats.stateUniversities, 'stats.stateUniversities'),
    privateUniversities: nonNegativeInteger(stats.privateUniversities, 'stats.privateUniversities'),
    averagePassingScore: nonNegativeInteger(stats.averagePassingScore, 'stats.averagePassingScore'),
  }
}

export function parseUniversityCatalog(value: unknown): UniversityCatalog {
  const catalog = record(value, 'catalog')
  if (catalog.catalogStatus !== 'ready' && catalog.catalogStatus !== 'empty') {
    throw new Error('Некорректные данные каталога: catalogStatus')
  }
  const items = array(catalog.items, 'items').map(parseUniversity)
  const stats = parseStats(catalog.stats)
  if (catalog.catalogStatus === 'empty' && (items.length !== 0 || stats.totalUniversities !== 0)) {
    throw new Error('Некорректные данные каталога: empty catalog')
  }
  return { items, stats, catalogStatus: catalog.catalogStatus }
}

export function parseUniversityDetail(value: unknown): University {
  return parseUniversity(record(value, 'detail').university)
}

export async function fetchUniversityCatalog(): Promise<UniversityCatalog> {
  return parseUniversityCatalog(await zhangakApiRequest<unknown>('/v1/platform/universities'))
}

export interface UniversityFilters {
  city?: string
  type?: UniversityType
  language?: StudyLanguage
  maxMinScore?: number
  dormitoryOnly?: boolean
  budgetOnly?: boolean
}

export async function fetchUniversities(filters: UniversityFilters = {}): Promise<University[]> {
  const { items } = await fetchUniversityCatalog()
  return items.filter(university => {
    if (filters.city && university.city !== filters.city) return false
    if (filters.type && university.type !== filters.type) return false
    if (filters.language && !university.languages.includes(filters.language)) return false
    if (filters.maxMinScore != null && university.minScore != null && university.minScore > filters.maxMinScore) return false
    if (filters.dormitoryOnly && !university.hasDormitory) return false
    if (filters.budgetOnly && !university.budgetSeats) return false
    return true
  })
}

export async function fetchUniversityById(id: string): Promise<University | null> {
  if (!UUID_PATTERN.test(id)) return null
  try {
    return parseUniversityDetail(await zhangakApiRequest<unknown>(`/v1/platform/universities/${encodeURIComponent(id)}`))
  } catch (error) {
    if (error instanceof ZhangakApiError && error.status === 404) return null
    throw error
  }
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  return (await fetchUniversityCatalog()).stats
}

// Favorites remain intentionally device-local until a first-party profile
// preference API is introduced. They are scoped by the own authenticated user
// id and are never trusted by the admission catalog API.
const FAVORITES_KEY = 'zhangak_university_favorites'

function favoritesKey(studentId: string): string {
  return `${FAVORITES_KEY}:${studentId}`
}

export function getFavoriteIds(studentId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(favoritesKey(studentId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function toggleFavorite(studentId: string, id: string): Set<string> {
  const favorites = getFavoriteIds(studentId)
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(favoritesKey(studentId), JSON.stringify([...favorites]))
  }
  return favorites
}
