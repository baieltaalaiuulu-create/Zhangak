// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// group_students has an RLS write policy scoped to admin/admin_jr/manager/director
// roles that rejects writes from the browser's anon-key client, so assigning or
// removing a student's group goes through this service-role route instead.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/api-auth'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { studentId, groupId } = await req.json()
    if (!studentId || !groupId) return NextResponse.json({ error: 'studentId и groupId обязательны' }, { status: 400 })

    const { error } = await supabaseAdmin.from('group_students').insert({ student_id: studentId, group_id: groupId })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { studentId } = await req.json()
    if (!studentId) return NextResponse.json({ error: 'studentId обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('group_students').delete().eq('student_id', studentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
