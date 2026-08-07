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
import { createAIGateway, AIGatewayError, type AIMessage, type MentorCardType } from '@/lib/ai-gateway'

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

  return `Ты AI Mentor на платформе Zhangak для подготовки к ОРТ в Кыргызстане.
Ученик: ${ctx.name}. Балл: ${ctx.currentScore}/245, цель: ${ctx.targetScore}, серия: ${ctx.streak} дней.
Слабые темы: ${listOrFallback(ctx.weakSections, 'пока не определены')}. Сильные: ${listOrFallback(ctx.strongSections, 'пока не определены')}.
Последние ошибки: ${listOrFallback(ctx.recentErrors, 'нет данных')}.
Контекст страницы: ${pageDescription}.

Ты не просто чат — ты персональный наставник. Правила:
- Отвечай структурированно: Теория → Пример → Совет → Действие
- Всегда используй данные ученика, не говори абстрактно
- Язык: русский (или кыргызский если пишет на кыргызском)
- Заканчивай конкретным действием

Формат ответа — ОБЯЗАТЕЛЬНО начни ровно с этих трёх строк, без markdown и кода:
TYPE: theory|task|analysis|plan|motivation|error
TITLE: короткий заголовок (без кавычек)
ACTIONS: действие 1|действие 2|действие 3 (через "|"; если действий нет — оставь "ACTIONS:" пустым)

Затем одна пустая строка, и после неё — основной текст ответа.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MentorRequestBody
    const { message, studentContext, history, pageContext, expectedType } = body
    if (!message || !studentContext) {
      return Response.json({ error: 'message и studentContext обязательны' }, { status: 400 })
    }

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
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e) {
    const userMessage = e instanceof AIGatewayError ? e.userMessage : 'AI временно недоступен. Попробуйте позже.'
    return Response.json({ error: userMessage }, { status: 502 })
  }
}
