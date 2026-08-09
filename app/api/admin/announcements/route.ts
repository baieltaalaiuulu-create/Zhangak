// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// announcements has RLS disabled (same as practice_tests/questions/practice_lessons), so
// writes go through this service-role route rather than the browser's anon-key client —
// same convention as the rest of app/api/admin/*.
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
    const { title, body, isActive, imageUrl, type } = await req.json()
    if (!title || !body) return NextResponse.json({ error: 'title и body обязательны' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({ title, body, is_active: isActive ?? true, image_url: imageUrl ?? null, type: type ?? 'info' })
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create announcement' }, { status: 400 })

    return NextResponse.json({ id: data.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    // Partial update — same route serves the full edit form and the quick
    // is_active toggle in the list, so only supplied fields are touched.
    const update: Record<string, unknown> = {}
    if (body.title !== undefined) update.title = body.title
    if (body.body !== undefined) update.body = body.body
    if (body.isActive !== undefined) update.is_active = !!body.isActive
    if (body.imageUrl !== undefined) update.image_url = body.imageUrl
    if (body.type !== undefined) update.type = body.type

    const { error } = await supabaseAdmin.from('announcements').update(update).eq('id', id)
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

    const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
