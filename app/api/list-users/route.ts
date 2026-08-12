import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ACCOUNT_MANAGER_ROLES, listManageableUserIds, requireRoleAuth } from '@/lib/api-auth'

export async function GET(req: Request) {
  const auth = await requireRoleAuth(req, ACCOUNT_MANAGER_ROLES)
  if (!auth.authorized) return auth.response

  if (!auth.role) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const scope = await listManageableUserIds(auth.admin, auth.role)
  if ('response' in scope) return scope.response

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const users: { id: string; email: string | null; banned_until: string | null; last_sign_in_at: string | null }[] = []
    const perPage = 200
    let page = 1

    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      for (const u of data.users) {
        if (auth.role !== 'super_admin' && !scope.ids.has(u.id)) continue
        users.push({ id: u.id, email: u.email ?? null, banned_until: u.banned_until ?? null, last_sign_in_at: u.last_sign_in_at ?? null })
      }
      if (data.users.length < perPage) break
      page++
    }

    return NextResponse.json({ users })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
