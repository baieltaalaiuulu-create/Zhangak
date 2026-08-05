// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// practice_tests carries the same admin-only RLS write policy as practice_lessons/questions
// (see app/api/admin/lessons), so create/update/delete go through this service-role route
// instead of the anon-key client.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { title, subject, lessonId, timeLimitMinutes, maxAttempts, isActive } = await req.json()
    if (!title || !subject) {
      return NextResponse.json({ error: 'title жана subject талап кылынат' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('practice_tests')
      .insert({
        title,
        subject,
        type: 'practice',
        lesson_id: lessonId || null,
        time_limit_minutes: timeLimitMinutes ?? null,
        max_attempts: maxAttempts ?? 1,
        is_active: !!isActive,
      })
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create practice test' }, { status: 400 })

    return NextResponse.json({ id: data.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id талап кылынат' }, { status: 400 })

    // Partial update — the same route serves both the full edit form and the
    // quick is_active toggle in the table, so only supplied fields are touched.
    const update: Record<string, unknown> = {}
    if (body.title !== undefined) update.title = body.title
    if (body.subject !== undefined) update.subject = body.subject
    if (body.lessonId !== undefined) update.lesson_id = body.lessonId || null
    if (body.timeLimitMinutes !== undefined) update.time_limit_minutes = body.timeLimitMinutes
    if (body.maxAttempts !== undefined) update.max_attempts = body.maxAttempts
    if (body.isActive !== undefined) update.is_active = !!body.isActive

    const { error } = await supabaseAdmin.from('practice_tests').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id талап кылынат' }, { status: 400 })

    await supabaseAdmin.from('questions').delete().eq('practice_test_id', id)
    const { error } = await supabaseAdmin.from('practice_tests').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
