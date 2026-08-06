// Requires GEMINI_API_KEY (server-only env var, e.g. set in Vercel project settings).
// Talks to Gemini 2.0 Flash over its plain REST endpoint rather than pulling in
// the @google/generative-ai SDK — this project has no AI SDK dependency yet and
// the request/response shape needed here is small enough that raw fetch keeps
// it that way.
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

type MentorCardType = 'theory' | 'task' | 'analysis' | 'plan' | 'motivation' | 'error'

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
  studentContext: StudentContext
  history?: ChatTurn[]
  pageContext?: PageContext
}

interface MentorResponse {
  type: MentorCardType
  title: string
  content: string
  actions: string[]
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(', ') : fallback
}

function buildSystemPrompt(ctx: StudentContext, pageContext?: PageContext): string {
  const pageDescription = pageContext
    ? `${pageContext.page} (${JSON.stringify(pageContext.contextData)})`
    : 'неизвестен'

  return `Ты AI Mentor на платформе Zhangak для подготовки к ОРТ в Кыргызстане.
Ученик: ${ctx.name}. Балл: ${ctx.currentScore}/245, цель: ${ctx.targetScore}, серия: ${ctx.streak} дней.
Слабые темы: ${listOrFallback(ctx.weakSections, 'пока не определены')}. Сильные: ${listOrFallback(ctx.strongSections, 'пока не определены')}.
Последние ошибки: ${listOrFallback(ctx.recentErrors, 'нет данных')}.
Контекст страницы: ${pageDescription}.

Ты не просто чат — ты персональный наставник. Правила:
- Отвечай структурированно: Теория → Пример → Совет → Действие
- Всегда используй данные ученика, не говори абстрактно
- Формат ответа: JSON { type: 'theory'|'task'|'analysis'|'plan'|'motivation'|'error', title: string, content: string, actions: string[] }
- Язык: русский (или кыргызский если пишет на кыргызском)
- Заканчивай конкретным действием`
}

const MENTOR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['theory', 'task', 'analysis', 'plan', 'motivation', 'error'] },
    title: { type: 'string' },
    content: { type: 'string' },
    actions: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'title', 'content', 'actions'],
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY не настроен на сервере' }, { status: 500 })
    }

    const body = await req.json() as MentorRequestBody
    const { message, studentContext, history, pageContext } = body
    if (!message || !studentContext) {
      return NextResponse.json({ error: 'message и studentContext обязательны' }, { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(studentContext, pageContext)

    const contents = [
      ...(history ?? []).map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: MENTOR_RESPONSE_SCHEMA,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return NextResponse.json({ error: `Gemini API error: ${errText.slice(0, 300)}` }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
    if (!rawText) {
      return NextResponse.json({ error: 'Пустой ответ от AI' }, { status: 502 })
    }

    let parsed: MentorResponse
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // Fallback for the rare case the model doesn't honor responseSchema —
      // surface the raw text as a plain card instead of failing outright.
      parsed = { type: 'theory', title: 'Ответ AI Mentor', content: rawText, actions: [] }
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
