// Requires SUPABASE_SERVICE_ROLE_KEY — same service-role write pattern as
// the rest of /api/admin/*.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface PrizeInput {
  place: 1 | 2 | 3
  title: string
  description: string | null
  imageUrl: string | null
}

// Bulk-saves the 1st/2nd/3rd place prizes for one week — upserts on
// (week_start, place) so re-saving the form updates in place instead of
// creating duplicate rows.
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { weekStart, prizes } = await req.json() as { weekStart: string; prizes: PrizeInput[] }
    if (!weekStart || !Array.isArray(prizes)) return NextResponse.json({ error: 'weekStart и prizes обязательны' }, { status: 400 })

    for (const p of prizes) {
      if (!p.title) continue
      const { data: existing } = await supabaseAdmin
        .from('weekly_prizes')
        .select('id')
        .eq('week_start', weekStart)
        .eq('place', p.place)
        .maybeSingle()

      if (existing) {
        const { error } = await supabaseAdmin
          .from('weekly_prizes')
          .update({ title: p.title, description: p.description, image_url: p.imageUrl })
          .eq('id', existing.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      } else {
        const { error } = await supabaseAdmin
          .from('weekly_prizes')
          .insert({ week_start: weekStart, place: p.place, title: p.title, description: p.description, image_url: p.imageUrl })
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
