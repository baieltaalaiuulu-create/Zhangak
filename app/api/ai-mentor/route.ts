// AI provider is fully abstracted behind lib/ai-gateway.ts (active provider:
// AI_PROVIDER env var, defaults to 'groq') — this route no longer talks to
// any specific vendor API directly.
//
// Response is now a plain-text stream instead of one-shot JSON, since Groq
// (and every other provider here) streams token-by-token and none of them
// offer Gemini's forced-JSON-schema constrained decoding over a streaming
// connection. To keep the structured type/title/actions card intact, the
// model is instructed to emit a small header block first:
//
//   TYPE: theory
//   TITLE: <title>
//   ACTIONS: action one|action two
//
//   <content, streams progressively after the blank line>
//
// The client (lib/ai-mentor-data.ts's streamMentorMessage) parses the
// header once it's seen a "\n\n", then re-renders content as more chunks
// arrive — see that file for the matching parser.
import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAIGateway, AIGatewayError, type AIMessage, type MentorCardType } from '@/lib/ai-gateway'
import { requireBearerAuth } from '@/lib/api-auth'

interface StudentContext {
  name: string
  currentScore: number
  targetScore: number
  streak: number
  weakSections: string[]
  strongSections: string[]
  recentResults: string[]
  completedLessons: number
  recentErrors: string[]
}

interface PageContext {
  page: 'lesson' | 'practice' | 'mock' | 'dashboard' | 'profile'
  contextData: Record<string, unknown>
}

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface MentorRequestBody {
  message: string
  history?: ChatTurn[]
  pageContext?: PageContext
  // Set by callers that already know what kind of response they're asking
  // for (the plan generator, AI Анализ) so the gateway can route straight
  // to the "complex" model tier without relying on message length alone.
  expectedType?: MentorCardType
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(', ') : fallback
}

function buildSystemPrompt(ctx: StudentContext, pageContext?: PageContext): string {
  const pageDescription = pageContext
    ? `${pageContext.page} (${JSON.stringify(pageContext.contextData)})`
    : 'неизвестен'

  return `Ты — AI-репетитор для подготовки к ОРТ (ЖРТ) в Кыргызстане. Ты ПОМОГАЕШЬ ТОЛЬКО с:
- Математикой (алгебра, геометрия, арифметика)
- Кыргызским языком (грамматика, понимание текста, аналогии)
- Стратегиями и советами по сдаче ОРТ

Ты НИКОГДА не генерируешь и не обсуждаешь темы вне программы ОРТ (никакой ядерной физики, биологии, истории — если это не часть программы ОРТ).
Если ученик спрашивает что-то не по теме, вежливо верни разговор к темам ОРТ — не отвечай на сам вопрос.
Всегда отвечай на русском или кыргызском языке.
Основывай свою помощь на реальных слабых темах ученика и его последних ошибках, а не на абстрактных советах.

Ученик: ${ctx.name}. Балл: ${ctx.currentScore}/245, цель: ${ctx.targetScore}, серия: ${ctx.streak} дней.
Слабые темы: ${listOrFallback(ctx.weakSections, 'пока не определены')}. Сильные: ${listOrFallback(ctx.strongSections, 'пока не определены')}.
Последние ошибки: ${listOrFallback(ctx.recentErrors, 'нет данных')}.
Контекст страницы: ${pageDescription}.

Ты не просто чат — ты персональный наставник. Правила:
- Отвечай структурированно: Теория → Пример → Совет → Действие
- Всегда используй данные ученика, не говори абстрактно
- Заканчивай конкретным действием

Формат ответа — ОБЯЗАТЕЛЬНО начни ровно с этих трёх строк, без markdown и кода:
TYPE: theory|task|analysis|plan|motivation|error
TITLE: короткий заголовок (без кавычек)
ACTIONS: действие 1|действие 2|действие 3 (через "|"; если действий нет — оставь "ACTIONS:" пустым)

Затем одна пустая строка, и после неё — основной текст ответа.`
}

interface ResultRow {
  total_score: number | null
  score: number | null
  completed_at: string
  test_type: string | null
  lesson_id: string | null
  answers: Record<string, string> | null
  practice_tests: { title: string | null } | null
}

interface QuestionRow {
  id: number
  section: string
  correct_answer: string
  question_text: string | null
}

const MAX_BODY_LENGTH = 32_000
const MAX_MESSAGE_LENGTH = 4_000
const MAX_HISTORY_TURNS = 12
const REQUESTS_PER_MINUTE = 12
const rateWindows = new Map<string, { startedAt: number; count: number }>()
const SECTION_LABELS: Record<string, string> = {
  math: 'Математика',
  comparison: 'Сравнение',
  analogy: 'Аналогии',
  reading: 'Чтение',
  grammar: 'Грамматика',
}
const ALLOWED_PAGES = new Set<PageContext['page']>(['lesson', 'practice', 'mock', 'dashboard', 'profile'])
const ALLOWED_RESPONSE_TYPES = new Set<MentorCardType>(['theory', 'task', 'analysis', 'plan', 'motivation', 'error'])

function plainText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t\0]+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function consumeRateLimit(userId: string): boolean {
  const now = Date.now()
  const existing = rateWindows.get(userId)
  if (!existing || now - existing.startedAt >= 60_000) {
    rateWindows.set(userId, { startedAt: now, count: 1 })
  } else if (existing.count >= REQUESTS_PER_MINUTE) {
    return false
  } else {
    existing.count += 1
  }

  if (rateWindows.size > 1_000) {
    for (const [key, window] of rateWindows) {
      if (now - window.startedAt >= 10 * 60_000) rateWindows.delete(key)
    }
  }
  return true
}

function calculateStreak(dates: string[]): number {
  const days = [...new Set(dates.map(date => date.slice(0, 10)))].sort().reverse()
  const cursor = new Date()
  let streak = 0
  for (const day of days) {
    if (day !== cursor.toISOString().slice(0, 10)) break
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

async function buildStudentContext(client: SupabaseClient, studentId: string): Promise<StudentContext> {
  const [{ data: profile, error: profileError }, { data: rawResults, error: resultsError }] = await Promise.all([
    client.from('profiles').select('full_name, target_score').eq('id', studentId).maybeSingle(),
    client
      .from('practice_results')
      .select('total_score, score, completed_at, test_type, lesson_id, answers, practice_tests(title)')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(50),
  ])
  if (profileError || resultsError) throw new Error('Student context is unavailable')

  const results = (rawResults ?? []) as unknown as ResultRow[]
  const latestMock = results.find(result => result.test_type === 'mock')
  const questionIds = [...new Set(
    results.flatMap(result => Object.keys(result.answers ?? {}).map(Number).filter(Number.isInteger)),
  )].slice(0, 300)

  let questions: QuestionRow[] = []
  if (questionIds.length > 0) {
    const { data, error } = await client
      .from('questions')
      .select('id, section, correct_answer, question_text')
      .in('id', questionIds)
    if (!error) questions = (data ?? []) as QuestionRow[]
  }

  const questionById = new Map(questions.map(question => [question.id, question]))
  const sectionStats = new Map<string, { correct: number; wrong: number }>()
  const recentErrors: string[] = []
  for (const result of results) {
    for (const [rawId, given] of Object.entries(result.answers ?? {})) {
      const question = questionById.get(Number(rawId))
      if (!question || question.section === 'general') continue
      const stats = sectionStats.get(question.section) ?? { correct: 0, wrong: 0 }
      const correct = question.correct_answer.trim().toUpperCase()[0] === String(given).trim().toUpperCase()[0]
      if (correct) stats.correct += 1
      else {
        stats.wrong += 1
        if (recentErrors.length < 5) {
          recentErrors.push(`${SECTION_LABELS[question.section] ?? question.section}: ${plainText(question.question_text, 80)}`)
        }
      }
      sectionStats.set(question.section, stats)
    }
  }

  const rankedSections = [...sectionStats.entries()]
    .map(([section, stats]) => ({
      section,
      ratio: stats.wrong / Math.max(1, stats.correct + stats.wrong),
    }))
  const weakSections = [...rankedSections]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map(item => SECTION_LABELS[item.section] ?? item.section)
  const strongSections = [...rankedSections]
    .sort((a, b) => a.ratio - b.ratio)
    .filter(item => !weakSections.includes(SECTION_LABELS[item.section] ?? item.section))
    .slice(0, 3)
    .map(item => SECTION_LABELS[item.section] ?? item.section)

  return {
    name: plainText(profile?.full_name, 100) || 'Студент',
    currentScore: Math.max(0, Math.min(245, Number(latestMock?.total_score ?? 0))),
    targetScore: Math.max(100, Math.min(245, Number(profile?.target_score ?? 180))),
    streak: calculateStreak(results.map(result => result.completed_at)),
    weakSections,
    strongSections,
    recentResults: results.slice(0, 5).map(result => {
      const title = plainText(result.practice_tests?.title, 100) || (result.test_type === 'mock' ? 'Пробный ОРТ' : 'Практика')
      const score = result.test_type === 'mock' ? result.total_score : result.score
      return `${title}: ${Number(score ?? 0)}`
    }),
    completedLessons: new Set(results.map(result => result.lesson_id).filter(Boolean)).size,
    recentErrors,
  }
}

function validateRequest(body: unknown): {
  message: string
  history: ChatTurn[]
  pageContext?: PageContext
  expectedType?: MentorCardType
} | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const input = body as MentorRequestBody
  const message = plainText(input.message, MAX_MESSAGE_LENGTH + 1)
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null

  if (input.history !== undefined && !Array.isArray(input.history)) return null
  const rawHistory = input.history ?? []
  if (rawHistory.length > MAX_HISTORY_TURNS) return null
  const history: ChatTurn[] = []
  for (const turn of rawHistory) {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) return null
    const content = plainText(turn.content, MAX_MESSAGE_LENGTH + 1)
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null
    history.push({ role: turn.role, content })
  }

  const pageContext = input.pageContext && ALLOWED_PAGES.has(input.pageContext.page)
    ? { page: input.pageContext.page, contextData: {} }
    : undefined
  const expectedType = input.expectedType && ALLOWED_RESPONSE_TYPES.has(input.expectedType)
    ? input.expectedType
    : undefined
  return { message, history, pageContext, expectedType }
}

export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.authorized) return auth.response
  if (!consumeRateLimit(auth.user.id)) {
    return Response.json({ error: 'Слишком много запросов. Попробуйте через минуту.' }, { status: 429 })
  }

  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_LENGTH) return Response.json({ error: 'Запрос слишком большой' }, { status: 413 })
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return Response.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    const input = validateRequest(parsedBody)
    if (!input) return Response.json({ error: 'Некорректный запрос' }, { status: 400 })
    const { message, history, pageContext, expectedType } = input
    const studentContext = await buildStudentContext(auth.client, auth.user.id)

    const systemPrompt = buildSystemPrompt(studentContext, pageContext)
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).map(turn => ({ role: turn.role, content: turn.content }) as AIMessage),
      { role: 'user', content: message },
    ]

    const gateway = createAIGateway()
    const stream = await gateway.stream(messages, { type: expectedType })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    const userMessage = e instanceof AIGatewayError ? e.userMessage : 'AI временно недоступен. Попробуйте позже.'
    return Response.json({ error: userMessage }, { status: 502 })
  }
}
