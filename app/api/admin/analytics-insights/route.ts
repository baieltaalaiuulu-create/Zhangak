// Requires GEMINI_API_KEY (server-only env var, e.g. set in Vercel project settings).
// Company-wide equivalent of /api/ai-mentor: that route's system prompt and
// { type, title, content, actions } shape are built specifically around one
// student, so aggregated analytics insights get their own small endpoint
// rather than being shoehorned into a per-student contract. Same Gemini 2.0
// Flash REST call, same responseSchema-constrained-JSON approach.
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

interface AnalyticsInsightsBody {
  stats: Record<string, unknown>
}

const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
  },
  required: ['insights'],
}

function buildPrompt(stats: Record<string, unknown>): string {
  return `Ты аналитик образовательной платформы Zhangak (подготовка к ОРТ в Кыргызстане).
Вот агрегированная статистика компании за выбранный период (JSON):
${JSON.stringify(stats, null, 2)}

Дай ровно 4 кратких, конкретных инсайта на русском языке на основе этих данных —
что идёт хорошо, что стоит улучшить, где риски, на что обратить внимание в первую
очередь. Каждый инсайт — одно-два предложения, используй реальные числа из данных,
не пиши абстрактно. Формат ответа: JSON { insights: string[] } — ровно 4 строки.`
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY не настроен на сервере' }, { status: 500 })
    }

    const { stats } = await req.json() as AnalyticsInsightsBody
    if (!stats) {
      return NextResponse.json({ error: 'stats обязателен' }, { status: 400 })
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(stats) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: INSIGHTS_SCHEMA,
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

    let parsed: { insights: string[] }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'AI вернул некорректный формат' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
