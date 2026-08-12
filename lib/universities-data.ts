import { supabase } from '@/lib/supabase'
export { getAdmissionProbability as getProbability } from '@/lib/university-matching'
export type { AdmissionProbability as Probability, ProbabilityLevel } from '@/lib/university-matching'

// Universities catalog — backed by Supabase (`universities`,
// `university_specialties`, `university_advantages`; RLS disabled on all
// three, same convention as practice_tests/questions/practice_lessons/
// announcements — reads go straight through the anon-key client below,
// admin writes go through /api/admin/universities and
// /api/admin/university-specialties with the service role, see those routes
// and lib/admin-data.ts's "Universities" section).
//
// The DB schema is intentionally lean (see the migration) and doesn't carry
// every field the UI shows — three notable gaps, resolved here rather than
// by changing the schema:
//   - No per-university "direction" column (IT/Medicine/…) — derived from
//     each specialty's faculty/name via keyword matching (deriveDirections).
//   - `languages`/`language` store full Russian words ('Русский', …) —
//     mapped to the short codes ('ru', …) the filter UI already uses.
//   - No documents/deadline columns — the "Документы" tab shows a shared,
//     generic Kyrgyzstan admission checklist instead of fabricating
//     per-university dates that aren't in the database.

export type UniversityType = 'state' | 'private'
export type City = string
export type Direction = 'it' | 'medicine' | 'economics' | 'law' | 'pedagogy'
export type StudyLanguage = 'ru' | 'kg' | 'tr' | 'en'

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

const LANGUAGE_CODE_BY_LABEL: Record<string, StudyLanguage> = {
  'Русский': 'ru',
  'Кыргызский': 'kg',
  'Турецкий': 'tr',
  'Английский': 'en',
}

const DIRECTION_KEYWORDS: Record<Direction, RegExp> = {
  it: /компьютер|информатик|программ/i,
  medicine: /мед|лечебн/i,
  economics: /эконом|бизнес|business/i,
  law: /юрид|юриспруденц|politic/i,
  pedagogy: /педагог|образован|дошкольн|начальн/i,
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
  costFrom: number | null // null = стоимость не опубликована
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

// ── Row shapes as they come back from Supabase ───────────────────────────

interface UniversityRow {
  id: string
  name: string
  city: string
  type: 'government' | 'private'
  description: string | null
  logo_url: string | null
  website_url: string | null
  min_score: number | null
  avg_score: number | null
  tuition_min: number | null
  tuition_max: number | null
  dormitory: boolean | null
  budget_places: boolean | null
  rating: number | null
  languages: string[] | null
  total_specialties: number | null
  is_active: boolean | null
}

interface SpecialtyRow {
  id: string
  university_id: string
  name: string
  faculty: string | null
  min_score: number | null
  tuition: number | null
  language: string | null
  form: string | null
  type: string | null
  is_active: boolean | null
}

interface AdvantageRow {
  id: string
  university_id: string
  icon: string | null
  title: string | null
  description: string | null
}

function deriveDirections(specialties: { name: string; faculty: string | null }[]): Direction[] {
  const found = new Set<Direction>()
  for (const s of specialties) {
    const text = `${s.name} ${s.faculty ?? ''}`
    for (const [dir, pattern] of Object.entries(DIRECTION_KEYWORDS) as [Direction, RegExp][]) {
      if (pattern.test(text)) found.add(dir)
    }
  }
  return [...found]
}

function mapSpecialty(row: SpecialtyRow): Specialty {
  return {
    id: row.id,
    name: row.name,
    faculty: row.faculty ?? '',
    minScore: row.min_score,
    costPerYear: row.tuition,
    language: row.language ?? '',
    form: row.form ?? 'Очная',
    type: row.type ?? 'Бюджет',
  }
}

function mapAdvantage(row: AdvantageRow): Advantage {
  const text = `${row.icon ?? ''} ${row.title ?? ''}`.toLowerCase()
  const iconKey: Advantage['iconKey'] = /междунар|international|язык|обмен/.test(text)
    ? 'international'
    : /карьер|работ|практик|стаж/.test(text)
      ? 'career'
      : /кампус|общежит|библиот|инфраструкт/.test(text)
        ? 'campus'
        : 'education'
  return { iconKey, title: row.title ?? '', description: row.description ?? '' }
}

function mapUniversity(row: UniversityRow, specialtyRows: SpecialtyRow[], advantageRows: AdvantageRow[]): University {
  const specialties = specialtyRows.filter(s => s.university_id === row.id && s.is_active !== false).map(mapSpecialty)
  const advantages = advantageRows.filter(a => a.university_id === row.id).map(mapAdvantage)

  return {
    id: row.id,
    name: row.name,
    shortName: row.name,
    logoUrl: row.logo_url,
    city: row.city,
    type: row.type === 'government' ? 'state' : 'private',
    minScore: row.min_score,
    avgScore: row.avg_score,
    costFrom: row.tuition_min,
    costMax: row.tuition_max,
    specialtyCount: row.total_specialties ?? specialties.length,
    rating: row.rating ?? 0,
    description: row.description ?? '',
    about: row.description ? [row.description] : [],
    advantages,
    hasDormitory: !!row.dormitory,
    budgetSeats: !!row.budget_places,
    directions: deriveDirections(specialties),
    languages: (row.languages ?? []).map(l => LANGUAGE_CODE_BY_LABEL[l]).filter((l): l is StudyLanguage => !!l),
    website: row.website_url ?? '',
    specialties,
    documents: GENERIC_ADMISSION_DOCUMENTS,
    applicationDeadline: GENERIC_ADMISSION_DEADLINE,
  }
}

// ── Fetching ──────────────────────────────────────────────────────────────

export interface UniversityFilters {
  city?: string
  type?: UniversityType
  language?: StudyLanguage
  maxMinScore?: number
  dormitoryOnly?: boolean
  budgetOnly?: boolean
}

// Applies the filters that map onto real, indexable columns server-side
// (city/type/dormitory/budget/score, plus a language array-overlap check).
// Free-text search and "direction" (a derived, not a real column) are left
// to the caller to apply client-side over the returned rows — the catalog
// is small enough that fetching once and refining in the browser is both
// simpler and snappier than round-tripping on every filter change.
export async function fetchUniversities(filters: UniversityFilters = {}): Promise<University[]> {
  let query = supabase.from('universities').select('*').eq('is_active', true)

  if (filters.city) query = query.eq('city', filters.city)
  if (filters.type) query = query.eq('type', filters.type === 'state' ? 'government' : 'private')
  if (filters.language) query = query.contains('languages', [LANGUAGE_LABELS[filters.language]])
  if (filters.maxMinScore != null) query = query.lte('min_score', filters.maxMinScore)
  if (filters.dormitoryOnly) query = query.eq('dormitory', true)
  if (filters.budgetOnly) query = query.eq('budget_places', true)

  const { data: universityRows, error: universitiesError } = await query.order('rating', { ascending: false })
  if (universitiesError) throw new Error('Не удалось загрузить каталог университетов')
  const universities = (universityRows ?? []) as UniversityRow[]
  if (universities.length === 0) return []

  const ids = universities.map(u => u.id)
  const [{ data: specialtyRows, error: specialtiesError }, { data: advantageRows, error: advantagesError }] = await Promise.all([
    supabase.from('university_specialties').select('*').in('university_id', ids),
    supabase.from('university_advantages').select('*').in('university_id', ids),
  ])
  if (specialtiesError || advantagesError) throw new Error('Не удалось загрузить данные университетов')

  return universities.map(u => mapUniversity(u, (specialtyRows ?? []) as SpecialtyRow[], (advantageRows ?? []) as AdvantageRow[]))
}

export async function fetchUniversityById(id: string): Promise<University | null> {
  const { data: universityRow, error: universityError } = await supabase.from('universities').select('*').eq('id', id).eq('is_active', true).maybeSingle()
  if (universityError) throw new Error('Не удалось загрузить университет')
  if (!universityRow) return null

  const [{ data: specialtyRows, error: specialtiesError }, { data: advantageRows, error: advantagesError }] = await Promise.all([
    supabase.from('university_specialties').select('*').eq('university_id', id),
    supabase.from('university_advantages').select('*').eq('university_id', id),
  ])
  if (specialtiesError || advantagesError) throw new Error('Не удалось загрузить данные университета')

  return mapUniversity(universityRow as UniversityRow, (specialtyRows ?? []) as SpecialtyRow[], (advantageRows ?? []) as AdvantageRow[])
}

// ── Catalog-level stats row ("52 Университета в каталоге" etc.) — computed
// live from the real table instead of hardcoded brochure copy. ────────────

export interface CatalogStats {
  totalUniversities: number
  totalSpecialties: number
  stateUniversities: number
  privateUniversities: number
  averagePassingScore: number
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  const { data, error } = await supabase.from('universities').select('type, min_score, total_specialties').eq('is_active', true)
  if (error) throw new Error('Не удалось загрузить статистику каталога')
  const rows = data ?? []

  const scores = rows.map(r => r.min_score).filter((s): s is number => s != null)

  return {
    totalUniversities: rows.length,
    totalSpecialties: rows.reduce((sum, r) => sum + (r.total_specialties ?? 0), 0),
    stateUniversities: rows.filter(r => r.type === 'government').length,
    privateUniversities: rows.filter(r => r.type === 'private').length,
    averagePassingScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  }
}

// ── Favorites ("Мои университеты") — localStorage only, same pattern as
// the AI Mentor's daily-plan cache (lib/ai-mentor-data.ts) and dismissed
// announcement banners (lib/notifications-data.ts); no DB table for this. ──

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
