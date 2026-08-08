// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// universities has RLS disabled (same as practice_tests/questions/practice_lessons/
// announcements), so writes go through this service-role route rather than the
// browser's anon-key client — same convention as the rest of app/api/admin/*.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const body = await req.json() as UniversityPayload
    if (!body.name || !body.city || !body.type) {
      return NextResponse.json({ error: 'name, city и type обязательны' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('universities')
      .insert(mapPayload(body))
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create university' }, { status: 400 })

    return NextResponse.json({ id: data.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const body = await req.json() as UniversityPayload & { id?: string }
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('universities').update(mapPayload(body)).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    // ON DELETE CASCADE on university_specialties/university_advantages
    // takes care of their rows.
    const { error } = await supabaseAdmin.from('universities').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
