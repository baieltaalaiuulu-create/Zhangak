// Generic key-value store for admin_settings (AI Autopilot toggle + its
// generation rules, stored as one JSON blob under a second key). Requires
// SUPABASE_SERVICE_ROLE_KEY — same service-role write pattern as the rest
// of /api/admin/*.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const supabaseAdmin = getAdminClient()
    const { data, error } = await supabaseAdmin.from('admin_settings').select('key, value')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const settings: Record<string, string> = {}
    for (const row of data ?? []) settings[row.key] = row.value ?? ''
    return NextResponse.json({ settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { key, value } = await req.json()
    if (!key) return NextResponse.json({ error: 'key обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({ key, value: String(value ?? ''), updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
