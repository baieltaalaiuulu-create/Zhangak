// AI provider is fully abstracted behind lib/ai-gateway.ts (active provider:
// AI_PROVIDER env var, defaults to 'groq') — this route no longer talks to
// any specific vendor API directly.
//
// Company-wide equivalent of /api/ai-mentor: that route's system prompt and
// { type, title, content, actions } shape are built specifically around one
// student, so aggregated analytics insights get their own small endpoint
// rather than being shoehorned into a per-student contract. This is a
// one-shot (non-streaming) call — gateway.complete() with jsonMode asks the
// provider to constrain output to valid JSON, then we parse it here.
import { NextRequest, NextResponse } from 'next/server'
import { createAIGateway, AIGatewayError, type AIMessage } from '@/lib/ai-gateway'

interface AnalyticsInsightsBody {
  stats: Record<string, unknown>
}

function buildPrompt(stats: Record<string, unknown>): string {
  return `Ты аналитик образовательной платформы Zhangak (подготовка к ОРТ в Кыргызстане).
Вот агрегированная статистика компании за выбранный период (JSON):
${JSON.stringify(stats, null, 2)}

Дай ровно 4 кратких, конкретных инсайта на русском языке на основе этих данных —
что идёт хорошо, что стоит улучшить, где риски, на что обратить внимание в первую
очередь. Каждый инсайт — одно-два предложения, используй реальные числа из данных,
не пиши абстрактно. Ответь СТРОГО валидным JSON без markdown и без пояснений,
ровно в этом формате: { "insights": ["...", "...", "...", "..."] } — ровно 4 строки.`
}

export async function POST(req: NextRequest) {
  try {
    const { stats } = await req.json() as AnalyticsInsightsBody
    if (!stats) {
      return NextResponse.json({ error: 'stats обязателен' }, { status: 400 })
    }

    const messages: AIMessage[] = [
      { role: 'user', content: buildPrompt(stats) },
    ]

    const gateway = createAIGateway()
    const rawText = await gateway.complete(messages, { type: 'analysis', jsonMode: true })

    let parsed: { insights: string[] }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'AI вернул некорректный формат' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const userMessage = e instanceof AIGatewayError ? e.userMessage : 'AI временно недоступен. Попробуйте позже.'
    return NextResponse.json({ error: userMessage }, { status: 502 })
  }
}
