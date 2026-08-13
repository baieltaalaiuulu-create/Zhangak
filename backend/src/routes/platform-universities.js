import { requireAuth } from '../auth.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'

const STUDENT_ROLES = ['student', 'math_student']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LANGUAGE_CODE_BY_LABEL = new Map([
  ['Русский', 'ru'],
  ['Кыргызский', 'kg'],
  ['Турецкий', 'tr'],
  ['Английский', 'en'],
  ['ru', 'ru'],
  ['kg', 'kg'],
  ['tr', 'tr'],
  ['en', 'en'],
])

const DIRECTION_KEYWORDS = [
  ['it', /компьютер|информатик|программ/i],
  ['medicine', /мед|лечебн/i],
  ['economics', /эконом|бизнес|business/i],
  ['law', /юрид|юриспруденц|politic/i],
  ['pedagogy', /педагог|образован|дошкольн|начальн/i],
]

function requireStudent(user) {
  if (!STUDENT_ROLES.includes(user.role)) throw new HttpError(403, 'Доступен только ученику', 'student_required')
  return user
}

async function currentStudent(config, req) {
  return requireStudent(await requireAuth(config, req))
}

function nullableNumber(value) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function nullableHttpUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

function publicLanguages(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map(label => LANGUAGE_CODE_BY_LABEL.get(label))
    .filter(Boolean))]
}

function publicSpecialty(row) {
  return {
    id: text(row.id),
    name: text(row.name),
    faculty: text(row.faculty),
    minScore: nullableNumber(row.min_score),
    costPerYear: nullableNumber(row.tuition),
    language: text(row.language),
    form: text(row.form, 'Очная'),
    type: text(row.type, 'Не указано'),
  }
}

function publicAdvantage(row) {
  const iconSource = `${text(row.icon)} ${text(row.title)}`.toLowerCase()
  const iconKey = /междунар|international|язык|обмен/.test(iconSource)
    ? 'international'
    : /карьер|работ|практик|стаж/.test(iconSource)
      ? 'career'
      : /кампус|общежит|библиот|инфраструкт/.test(iconSource)
        ? 'campus'
        : 'education'
  return {
    iconKey,
    title: text(row.title),
    description: text(row.description),
  }
}

function directionsFor(specialties) {
  const found = new Set()
  for (const specialty of specialties) {
    const haystack = `${specialty.name} ${specialty.faculty}`
    for (const [direction, pattern] of DIRECTION_KEYWORDS) {
      if (pattern.test(haystack)) found.add(direction)
    }
  }
  return [...found]
}

/**
 * The catalog projection deliberately contains only student-safe published
 * fields. Internal active flags and any future curation metadata remain in
 * PostgreSQL and never cross this boundary.
 */
export function publicUniversity(row) {
  const specialties = Array.isArray(row.specialties) ? row.specialties.map(publicSpecialty) : []
  const description = text(row.description)
  const name = text(row.name)
  return {
    id: text(row.id),
    name,
    shortName: name,
    logoUrl: nullableHttpUrl(row.logo_url),
    city: text(row.city),
    type: row.type === 'government' ? 'state' : 'private',
    minScore: nullableNumber(row.min_score),
    avgScore: nullableNumber(row.avg_score),
    costFrom: nullableNumber(row.tuition_min),
    costMax: nullableNumber(row.tuition_max),
    specialtyCount: specialties.length,
    rating: nullableNumber(row.rating) ?? 0,
    description,
    about: description ? [description] : [],
    advantages: Array.isArray(row.advantages) ? row.advantages.map(publicAdvantage) : [],
    hasDormitory: row.dormitory === true,
    budgetSeats: row.budget_places === true,
    directions: directionsFor(specialties),
    languages: publicLanguages(row.languages),
    website: nullableHttpUrl(row.website_url) ?? '',
    specialties,
  }
}

function catalogStats(items) {
  const scores = items.map(item => item.minScore).filter(score => score != null)
  return {
    totalUniversities: items.length,
    totalSpecialties: items.reduce((total, item) => total + item.specialtyCount, 0),
    stateUniversities: items.filter(item => item.type === 'state').length,
    privateUniversities: items.filter(item => item.type === 'private').length,
    averagePassingScore: scores.length === 0
      ? 0
      : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length),
  }
}

async function catalogRows(universityId = null) {
  const result = await query(
    `SELECT u.id, u.name, u.city, u.type, u.description, u.logo_url, u.website_url,
            u.min_score, u.avg_score, u.tuition_min, u.tuition_max,
            u.dormitory, u.budget_places, u.rating, u.languages,
            coalesce((
              SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'faculty', s.faculty,
                'min_score', s.min_score,
                'tuition', s.tuition,
                'language', s.language,
                'form', s.form,
                'type', s.type
              ) ORDER BY lower(s.name), s.id)
              FROM university_specialties s
             WHERE s.university_id = u.id
               AND s.is_active = true
            ), '[]'::jsonb) AS specialties,
            coalesce((
              SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'icon', a.icon,
                'title', a.title,
                'description', a.description
              ) ORDER BY a.created_at, a.id)
              FROM university_advantages a
             WHERE a.university_id = u.id
            ), '[]'::jsonb) AS advantages
       FROM universities u
      WHERE u.is_active = true
        AND ($1::uuid IS NULL OR u.id = $1)
      ORDER BY u.rating DESC NULLS LAST, u.name, u.id`,
    [universityId],
  )
  return result.rows
}

GET('/v1/platform/universities', async ({ req, config }) => {
  await currentStudent(config, req)
  const items = (await catalogRows()).map(publicUniversity)
  return {
    status: 200,
    body: {
      items,
      stats: catalogStats(items),
      catalogStatus: items.length === 0 ? 'empty' : 'ready',
    },
  }
})

GET('/v1/platform/universities/:id', async ({ req, params, config }) => {
  await currentStudent(config, req)
  if (!UUID_PATTERN.test(params.id)) throw new HttpError(400, 'Некорректный id университета', 'invalid_university_id')
  const row = (await catalogRows(params.id))[0]
  if (!row) throw new HttpError(404, 'Университет не найден', 'university_not_found')
  return { status: 200, body: { university: publicUniversity(row) } }
})
