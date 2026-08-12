import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_CREATOR_ROLES, canCreateAccount, isAccountRole, requireRoleAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const auth = await requireRoleAuth(req, ACCOUNT_CREATOR_ROLES)
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { full_name, email, password, phone, role, student_type, target_score, class_number } = await req.json()

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Обязательно заполните: ФИО, email, пароль' }, { status: 400 })
    }

    const targetRole = role ?? 'student'
    if (!isAccountRole(targetRole)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 })
    }
    if (!auth.role || !canCreateAccount(auth.role, targetRole)) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? 'Не удалось создать пользователя' }, { status: 400 })
    }

    const profile: Record<string, unknown> = { id: created.user.id, full_name, role: targetRole }
    if (phone) profile.phone = phone
    if (student_type) profile.student_type = student_type
    if (target_score) profile.target_score = target_score
    if (class_number) profile.class_number = class_number

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' })
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: created.user.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
