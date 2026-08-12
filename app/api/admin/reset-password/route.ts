// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// Password resets need the auth admin API (service role), same pattern as block-user's
// ban/unban call — there's no anon-key equivalent for setting another user's password.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_MANAGER_ROLES, authorizeAccountManagement, requireRoleAuth } from '@/lib/api-auth'

const MIN_PASSWORD_LENGTH = 6

export async function POST(req: NextRequest) {
  const auth = await requireRoleAuth(req, ACCOUNT_MANAGER_ROLES)
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { id, password } = await req.json()
    if (!id || !password) return NextResponse.json({ error: 'id и password обязательны' }, { status: 400 })
    if (id === auth.user.id) return NextResponse.json({ error: 'Используйте восстановление собственного пароля' }, { status: 400 })
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` }, { status: 400 })
    }
    if (!auth.role) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    const authorizationError = await authorizeAccountManagement(auth.admin, auth.role, id)
    if (authorizationError) return authorizationError

    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
