import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_MANAGER_ROLES, authorizeAccountManagement, requireRoleAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const auth = await requireRoleAuth(req, ACCOUNT_MANAGER_ROLES)
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { id } = await req.json()
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
    if (id === auth.user.id) return NextResponse.json({ error: 'Используйте удаление собственного аккаунта' }, { status: 400 })
    if (!auth.role) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    const authorizationError = await authorizeAccountManagement(auth.admin, auth.role, id)
    if (authorizationError) return authorizationError

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Неизвестная ошибка' }, { status: 500 })
  }
}
