// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// questions has an RLS write policy scoped to admin/admin_jr roles that rejects
// writes from the browser's anon-key client, so question create/update/delete
// go through this service-role route instead.
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
    const supabaseAdmin = getAdminClient()
    const { testId, payload, orderNum } = await req.json()
    if (!testId || !payload) return NextResponse.json({ error: 'testId и payload обязательны' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('questions')
      .insert({ practice_test_id: testId, ...payload, order_num: orderNum })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { id, payload } = await req.json()
    if (!id || !payload) return NextResponse.json({ error: 'id и payload обязательны' }, { status: 400 })

    const { error } = await supabaseAdmin.from('questions').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabaseAdmin.from('questions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
