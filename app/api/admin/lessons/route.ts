// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// practice_lessons/practice_tests/questions all carry an RLS write policy scoped
// to admin/admin_jr roles that rejects writes from the browser's anon-key client,
// so lesson create/update/delete go through this service-role route instead.
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
    const { title, description, subject, order_number, video_url } = await req.json()
    if (!title || !subject) {
      return NextResponse.json({ error: 'title жана subject талап кылынат' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('practice_lessons')
      .insert({
        title,
        description: description || null,
        subject,
        order_number: order_number ?? 0,
        video_url: video_url || null,
      })
      .select('id, title, subject')
      .single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create lesson' }, { status: 400 })

    return NextResponse.json({ lesson: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { id, title, description, subject, order_number, video_url } = await req.json()
    if (!id || !title || !subject) {
      return NextResponse.json({ error: 'id, title жана subject талап кылынат' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('practice_lessons')
      .update({
        title,
        description: description || null,
        subject,
        order_number: order_number ?? 0,
        video_url: video_url || null,
      })
      .eq('id', id)
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

    const { data: tests } = await supabaseAdmin.from('practice_tests').select('id').eq('lesson_id', id)
    const testIds = (tests ?? []).map(t => t.id)
    if (testIds.length) {
      await supabaseAdmin.from('questions').delete().in('practice_test_id', testIds)
      await supabaseAdmin.from('practice_tests').delete().in('id', testIds)
    }

    const { error } = await supabaseAdmin.from('practice_lessons').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
