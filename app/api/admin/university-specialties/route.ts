// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// university_specialties has RLS disabled (same as universities), so writes go
// through this service-role route — same convention as the rest of app/api/admin/*.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/api-auth'

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

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const body = await req.json() as SpecialtyPayload
    if (!body.universityId || !body.name) {
      return NextResponse.json({ error: 'universityId и name обязательны' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('university_specialties')
      .insert(mapPayload(body))
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create specialty' }, { status: 400 })

    return NextResponse.json({ id: data.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const body = await req.json() as SpecialtyPayload & { id?: string }
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('university_specialties').update(mapPayload(body)).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('university_specialties').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
