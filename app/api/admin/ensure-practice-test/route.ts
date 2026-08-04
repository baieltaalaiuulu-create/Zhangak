import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { lessonId, title, subject, setActive } = await req.json()
    if (!lessonId || !title || !subject) {
      return NextResponse.json({ error: 'lessonId, title, subject талап кылынат' }, { status: 400 })
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('practice_tests')
      .select('id, is_active')
      .eq('lesson_id', lessonId)
      .eq('type', 'practice')
      .limit(1)
      .maybeSingle()
    if (findError) return NextResponse.json({ error: findError.message }, { status: 400 })

    let test = existing
    if (!test) {
      const { data: created, error: createError } = await supabaseAdmin
        .from('practice_tests')
        .insert({
          title: `Практика: ${title}`,
          subject,
          type: 'practice',
          lesson_id: lessonId,
          is_active: false,
          max_attempts: 5,
          time_limit_minutes: 30,
        })
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
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
