// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
//
// Deliberately NOT the same code path as /api/delete-user (admin-only, UI-gated,
// trusts a client-supplied id with no ownership check). This route is exposed to
// every signed-in student for self-service account deletion, so the id being
// deleted is derived from the caller's own session token via supabaseAdmin.auth.getUser
// — never from the request body — so a student can only ever delete their own account.
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
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const supabaseAdmin = getAdminClient()
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const userId = userData.user.id

    // payments/math_results carry a NO ACTION (restrict) FK to profiles — must
    // clear them first or the profile delete below fails. group_students etc.
    // already CASCADE, so no need to touch those explicitly.
    await supabaseAdmin.from('payments').delete().eq('student_id', userId)
    await supabaseAdmin.from('math_results').delete().eq('student_id', userId)

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Белгисиз ката'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
