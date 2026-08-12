// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// universities has RLS disabled (same as practice_tests/questions/practice_lessons/
// announcements), so writes go through this service-role route rather than the
// browser's anon-key client — same convention as the rest of app/api/admin/*.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/api-auth'
import { JsonBodyError, readJsonObject } from '@/lib/server-json'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface UniversityPayload {
  name?: string
  city?: string
  type?: 'government' | 'private'
  description?: string | null
  logoUrl?: string | null
  websiteUrl?: string | null
  minScore?: number | null
  avgScore?: number | null
  tuitionMin?: number | null
  tuitionMax?: number | null
  dormitory?: boolean
  budgetPlaces?: boolean
  rating?: number | null
  languages?: string[]
  totalSpecialties?: number | null
  isActive?: boolean
}

// Only the fields the request body actually supplied get mapped — used by
// both create (full payload expected) and the partial-update PATCH.
function mapPayload(body: UniversityPayload): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (body.name !== undefined) row.name = body.name
  if (body.city !== undefined) row.city = body.city
  if (body.type !== undefined) row.type = body.type
  if (body.description !== undefined) row.description = body.description
  if (body.logoUrl !== undefined) row.logo_url = body.logoUrl
  if (body.websiteUrl !== undefined) row.website_url = body.websiteUrl
  if (body.minScore !== undefined) row.min_score = body.minScore
  if (body.avgScore !== undefined) row.avg_score = body.avgScore
  if (body.tuitionMin !== undefined) row.tuition_min = body.tuitionMin
  if (body.tuitionMax !== undefined) row.tuition_max = body.tuitionMax
  if (body.dormitory !== undefined) row.dormitory = !!body.dormitory
  if (body.budgetPlaces !== undefined) row.budget_places = !!body.budgetPlaces
  if (body.rating !== undefined) row.rating = body.rating
  if (body.languages !== undefined) row.languages = body.languages
  if (body.totalSpecialties !== undefined) row.total_specialties = body.totalSpecialties
  if (body.isActive !== undefined) row.is_active = !!body.isActive
  return row
}

function isOptionalScore(value: unknown): boolean {
  return value === undefined || value === null || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 245)
}

function isOptionalMoney(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100_000_000)
}

function validatePayload(body: UniversityPayload): string | null {
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200)) return 'Некорректное название'
  if (body.city !== undefined && (typeof body.city !== 'string' || !body.city.trim() || body.city.length > 100)) return 'Некорректный город'
  if (body.type !== undefined && body.type !== 'government' && body.type !== 'private') return 'Некорректный тип университета'
  if (!isOptionalScore(body.minScore) || !isOptionalScore(body.avgScore)) return 'Балл должен быть от 0 до 245'
  if (!isOptionalMoney(body.tuitionMin) || !isOptionalMoney(body.tuitionMax)) return 'Некорректная стоимость'
  if (body.rating !== undefined && body.rating !== null && (typeof body.rating !== 'number' || body.rating < 0 || body.rating > 5)) return 'Рейтинг должен быть от 0 до 5'
  if (body.websiteUrl && (!/^https?:\/\//i.test(body.websiteUrl) || body.websiteUrl.length > 500)) return 'Некорректная ссылка на сайт'
  if (body.logoUrl && (!/^https?:\/\//i.test(body.logoUrl) || body.logoUrl.length > 1000)) return 'Некорректная ссылка на логотип'
  if (body.languages !== undefined && (!Array.isArray(body.languages) || body.languages.length > 10 || body.languages.some(language => typeof language !== 'string' || language.length > 50))) return 'Некорректный список языков'
  return null
}

export async function GET(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const id = req.nextUrl.searchParams.get('id')
    let query = supabaseAdmin.from('universities').select('*').order('created_at', { ascending: false })
    if (id) query = query.eq('id', id)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Не удалось загрузить университеты' }, { status: 503 })
    return NextResponse.json({ universities: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const body = await readJsonObject(req) as UniversityPayload
    const validationError = validatePayload(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    if (!body.name || !body.city || !body.type) {
      return NextResponse.json({ error: 'name, city и type обязательны' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('universities')
      .insert(mapPayload(body))
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Не удалось создать университет' }, { status: 400 })

    return NextResponse.json({ id: data.id })
  } catch (error) {
    if (error instanceof JsonBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 503 })
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const body = await readJsonObject(req) as UniversityPayload & { id?: string }
    const validationError = validatePayload(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('universities').update(mapPayload(body)).eq('id', id)
    if (error) return NextResponse.json({ error: 'Не удалось обновить университет' }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof JsonBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await readJsonObject(req)
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    // ON DELETE CASCADE on university_specialties/university_advantages
    // takes care of their rows.
    const { error } = await supabaseAdmin.from('universities').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Не удалось удалить университет' }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof JsonBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 503 })
  }
}
