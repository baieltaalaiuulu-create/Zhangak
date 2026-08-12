// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// university_specialties has RLS disabled (same as universities), so writes go
// through this service-role route — same convention as the rest of app/api/admin/*.
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

interface SpecialtyPayload {
  universityId?: string
  name?: string
  faculty?: string | null
  minScore?: number | null
  tuition?: number | null
  language?: string | null
  form?: string
  type?: string
  isActive?: boolean
}

function mapPayload(body: SpecialtyPayload): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (body.universityId !== undefined) row.university_id = body.universityId
  if (body.name !== undefined) row.name = body.name
  if (body.faculty !== undefined) row.faculty = body.faculty
  if (body.minScore !== undefined) row.min_score = body.minScore
  if (body.tuition !== undefined) row.tuition = body.tuition
  if (body.language !== undefined) row.language = body.language
  if (body.form !== undefined) row.form = body.form
  if (body.type !== undefined) row.type = body.type
  if (body.isActive !== undefined) row.is_active = !!body.isActive
  return row
}

function validatePayload(body: SpecialtyPayload): string | null {
  if (body.universityId !== undefined && (typeof body.universityId !== 'string' || !body.universityId || body.universityId.length > 100)) return 'Некорректный universityId'
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200)) return 'Некорректное название'
  if (body.minScore !== undefined && body.minScore !== null && (!Number.isInteger(body.minScore) || body.minScore < 0 || body.minScore > 245)) return 'Балл должен быть от 0 до 245'
  if (body.tuition !== undefined && body.tuition !== null && (typeof body.tuition !== 'number' || !Number.isFinite(body.tuition) || body.tuition < 0 || body.tuition > 100_000_000)) return 'Некорректная стоимость'
  for (const value of [body.faculty, body.language, body.form, body.type]) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 200)) return 'Некорректное текстовое поле'
  }
  return null
}

export async function GET(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  const universityId = req.nextUrl.searchParams.get('universityId')
  if (!universityId) return NextResponse.json({ error: 'universityId обязателен' }, { status: 400 })

  try {
    const supabaseAdmin = getAdminClient()
    const { data, error } = await supabaseAdmin
      .from('university_specialties')
      .select('*')
      .eq('university_id', universityId)
      .order('name', { ascending: true })
    if (error) return NextResponse.json({ error: 'Не удалось загрузить специальности' }, { status: 503 })
    return NextResponse.json({ specialties: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const body = await readJsonObject(req) as SpecialtyPayload
    const validationError = validatePayload(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    if (!body.universityId || !body.name) {
      return NextResponse.json({ error: 'universityId и name обязательны' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('university_specialties')
      .insert(mapPayload(body))
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Не удалось создать специальность' }, { status: 400 })

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
    const body = await readJsonObject(req) as SpecialtyPayload & { id?: string }
    const validationError = validatePayload(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('university_specialties').update(mapPayload(body)).eq('id', id)
    if (error) return NextResponse.json({ error: 'Не удалось обновить специальность' }, { status: 400 })

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

    const { error } = await supabaseAdmin.from('university_specialties').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Не удалось удалить специальность' }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof JsonBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 503 })
  }
}
