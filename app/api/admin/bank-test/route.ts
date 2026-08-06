// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// practice_tests carries the same admin-only RLS write policy as elsewhere, so
// find-or-create for the standalone question-bank tests (lesson_id=null, one
// per subject bucket) goes through this service-role route instead of the
// anon client — mirrors app/api/admin/ensure-practice-test for lesson-linked tests.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { subject, title } = await req.json()
    if (!subject || !title) {
      return NextResponse.json({ error: 'subject жана title талап кылынат' }, { status: 400 })
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('practice_tests')
      .select('id')
      .eq('subject', subject)
      .eq('type', 'practice')
      .is('lesson_id', null)
      .limit(1)
      .maybeSingle()
    if (findError) return NextResponse.json({ error: findError.message }, { status: 400 })

    if (existing) return NextResponse.json({ test: existing })

    // Untimed, effectively-unlimited attempts — bank practice is meant to be
    // retaken freely, unlike lesson-tied tests which cap attempts.
    const { data: created, error: createError } = await supabaseAdmin
      .from('practice_tests')
      .insert({ title, subject, type: 'practice', lesson_id: null, is_active: true, max_attempts: 999 })
      .select('id')
      .single()
    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? 'Failed to create bank test' }, { status: 400 })
    }

    return NextResponse.json({ test: created })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
