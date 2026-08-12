// Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var, e.g. set in Vercel project settings).
// questions has an RLS write policy scoped to admin/admin_jr roles that rejects
// writes from the browser's anon-key client, so question create/update/delete
// go through this service-role route instead.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireContentAdminApi } from '@/lib/api-auth'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const QUESTION_TEXT_FIELDS = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d'] as const
const QUESTION_FIELDS = new Set([
  ...QUESTION_TEXT_FIELDS,
  'correct_answer',
  'section',
  'topic',
  'difficulty',
  'image_url',
])

function sanitizeQuestionPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (Object.keys(source).some(key => !QUESTION_FIELDS.has(key))) return null

  const result: Record<string, unknown> = {}
  for (const field of QUESTION_TEXT_FIELDS) {
    const item = source[field]
    if (item === undefined) continue
    if (typeof item !== 'string' || item.length > 10_000) return null
    result[field] = item
  }

  if (source.correct_answer !== undefined) {
    if (!['A', 'B', 'C', 'D'].includes(String(source.correct_answer))) return null
    result.correct_answer = source.correct_answer
  }
  if (source.section !== undefined) {
    if (typeof source.section !== 'string' || source.section.length > 64) return null
    result.section = source.section
  }
  if (source.topic !== undefined) {
    if (source.topic !== null && (typeof source.topic !== 'string' || source.topic.length > 200)) return null
    result.topic = source.topic
  }
  if (source.difficulty !== undefined) {
    if (!['easy', 'medium', 'hard'].includes(String(source.difficulty))) return null
    result.difficulty = source.difficulty
  }
  if (source.image_url !== undefined) {
    if (source.image_url !== null && (typeof source.image_url !== 'string' || source.image_url.length > 2_048)) return null
    result.image_url = source.image_url
  }

  return Object.keys(result).length > 0 ? result : null
}

export async function POST(req: NextRequest) {
  const authError = await requireContentAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { testId, payload, orderNum } = await req.json()
    const safePayload = sanitizeQuestionPayload(payload)
    if (!Number.isInteger(testId) || testId <= 0 || !safePayload || !Number.isInteger(orderNum) || orderNum < 0) {
      return NextResponse.json({ error: 'Некорректные данные вопроса' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('questions')
      .insert({ practice_test_id: testId, ...safePayload, order_num: orderNum })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireContentAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { id, payload } = await req.json()
    const safePayload = sanitizeQuestionPayload(payload)
    if (!Number.isInteger(id) || id <= 0 || !safePayload) {
      return NextResponse.json({ error: 'Некорректные данные вопроса' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('questions').update(safePayload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireContentAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await req.json()
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

    const { error } = await supabaseAdmin.from('questions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
