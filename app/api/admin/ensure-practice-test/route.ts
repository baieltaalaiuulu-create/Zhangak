// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// Single find-or-create endpoint for both lesson-tied practice tests AND the
// standalone question bank (lesson_id=null, one row per subject bucket).
//
// Previously the bank had its own separate route (app/api/admin/bank-test)
// that duplicated this find-or-create logic, while THIS route hard-rejected
// lessonId=null with a 400. Any caller that ever passed lessonId=null here
// (directly, or by a future refactor routing the bank through "the" ensure
// function) would get an error instead of the existing bank row — the fix
// is to treat lessonId=null as its own valid case: find by subject + type
// + lesson_id IS NULL instead of by lesson_id, so it's still impossible to
// end up with a second row for the same bucket.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { lessonId, title, subject, setActive } = await req.json()
    if (!title || !subject) {
      return NextResponse.json({ error: 'title и subject обязательны' }, { status: 400 })
    }

    const findQuery = supabaseAdmin
      .from('practice_tests')
      .select('id, is_active')
      .eq('type', 'practice')
      .limit(1)
    const { data: existing, error: findError } = lessonId
      ? await findQuery.eq('lesson_id', lessonId).maybeSingle()
      : await findQuery.eq('subject', subject).is('lesson_id', null).maybeSingle()
    if (findError) return NextResponse.json({ error: findError.message }, { status: 400 })

    let test = existing
    if (!test) {
      const { data: created, error: createError } = await supabaseAdmin
        .from('practice_tests')
        .insert(
          lessonId
            ? { title: `Практика: ${title}`, subject, type: 'practice', lesson_id: lessonId, is_active: false, max_attempts: 5, time_limit_minutes: 30 }
            // Untimed, effectively-unlimited attempts — bank practice is meant
            // to be retaken freely, unlike lesson-tied tests which cap attempts.
            : { title, subject, type: 'practice', lesson_id: null, is_active: true, max_attempts: 999 }
        )
        .select('id, is_active')
        .single()
      if (createError || !created) {
        return NextResponse.json({ error: createError?.message ?? 'Failed to create practice test' }, { status: 400 })
      }
      test = created
    }

    if (typeof setActive === 'boolean' && test.is_active !== setActive) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('practice_tests')
        .update({ is_active: setActive })
        .eq('id', test.id)
        .select('id, is_active')
        .single()
      if (updateError || !updated) {
        return NextResponse.json({ error: updateError?.message ?? 'Failed to update practice test' }, { status: 400 })
      }
      test = updated
    }

    return NextResponse.json({ test })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
