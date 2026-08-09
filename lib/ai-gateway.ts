// Unified AI client — every AI call in this app (student AI Mentor, admin
// analytics insights) goes through here instead of hitting a provider's API
// directly, so swapping providers is a one-line env var change instead of a
// grep-and-replace across every route. Active provider: AI_PROVIDER
// ('groq' | 'gemini' | 'openai' | 'ollama'), defaults to 'groq'.
//
// All providers speak the same two methods:
//   - stream(messages, options)   → Promise<ReadableStream<Uint8Array>> of
//     plain-text content chunks (already unwrapped from each provider's own
//     SSE payload shape via a TransformStream), ready to hand straight to
//     `new Response(stream, ...)` in a route handler.
//   - complete(messages, options) → Promise<string>, the same stream read to
//     completion and concatenated — for call sites that don't need
//     progressive rendering (e.g. analytics insights).

export type AIRole = 'system' | 'user' | 'assistant'

export interface AIMessage {
  role: AIRole
  content: string
}

export type MentorCardType = 'theory' | 'task' | 'analysis' | 'plan' | 'motivation' | 'error'

export interface AICompleteOptions {
  // Feeds the simple-vs-complex model selection heuristic below — analysis
  // and plan generation get the bigger model regardless of message length.
  type?: MentorCardType
  // Ask the provider to constrain output to valid JSON (OpenAI-compatible
  // response_format / Gemini responseMimeType) — used by the non-streaming
  // analytics-insights call, not by the card-streaming protocol.
  jsonMode?: boolean
}

export interface AIGateway {
  stream(messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>>
  complete(messages: AIMessage[], options?: AICompleteOptions): Promise<string>
}

// Baseline scope guardrail applied to every AI Gateway call, regardless of
// caller — the AI Mentor route builds its own much more detailed prompt on
// top of this (student context, response formatting), but this is the
// floor: it's what stops the assistant from wandering off ORT curriculum
// even if a caller's own system prompt is ever weakened, missing, or
// bypassed. Every current caller (AI Mentor chat, daily-challenge/knowledge
// base question generation, analytics insights) is itself an ORT-prep task,
// so this is compatible with all of them, not just the student chat.
export const DEFAULT_SYSTEM_MESSAGE = `Ты — AI-репетитор для подготовки к ОРТ (ЖРТ) в Кыргызстане. Ты ПОМОГАЕШЬ ТОЛЬКО с:
- Математикой (алгебра, геометрия, арифметика)
- Кыргызским языком (грамматика, понимание текста, аналогии)
- Стратегиями и советами по сдаче ОРТ

Ты НИКОГДА не генерируешь и не обсуждаешь темы вне программы ОРТ (никакой ядерной физики, биологии, истории — если это не часть программы ОРТ).
Если ученик спрашивает что-то не по теме, вежливо верни разговор к темам ОРТ — не отвечай на сам вопрос.
Всегда отвечай на русском или кыргызском языке.
Основывай свою помощь на реальных слабых темах ученика и его последних ошибках, если они известны.`

// Thrown by every provider on any failure before/while establishing the
// stream. `userMessage` is always Russian and safe to show directly —
// callers should never surface `message` (the technical detail) to a user.
export class AIGatewayError extends Error {
  userMessage: string
  constructor(message: string, userMessage: string) {
    super(message)
    this.name = 'AIGatewayError'
    this.userMessage = userMessage
  }
}

const ERR_NETWORK = 'Соединение прервано. Попробуйте ещё раз.'
const ERR_API = 'AI временно недоступен. Попробуйте позже.'
const ERR_RATE_LIMIT = 'Слишком много запросов. Подождите немного.'

// "Complex" = analysis/plan generation, or just a long message — these get
// routed to the bigger model; everything else gets the fast/cheap one.
const COMPLEXITY_LENGTH_THRESHOLD = 200

function isComplex(messages: AIMessage[], options?: AICompleteOptions): boolean {
  if (options?.type === 'analysis' || options?.type === 'plan') return true
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  return (lastUser?.content.length ?? 0) > COMPLEXITY_LENGTH_THRESHOLD
}

// ── SSE → plain-text chunk transforms ────────────────────────────────────
// Both providers' SSE bodies arrive as `data: {...}\n\n` lines; each line
// wraps a provider-specific delta shape. The transform strips the SSE
// envelope and forwards just the new text so the client only ever sees
// content, never protocol framing.

function createOpenAICompatibleSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const delta: unknown = json?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) controller.enqueue(encoder.encode(delta))
        } catch {
          // Partial line split across chunks, or a keep-alive comment — safe to skip.
        }
      }
    },
  })
}

function createGeminiSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        try {
          const json = JSON.parse(payload)
          const delta: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text
          if (typeof delta === 'string' && delta) controller.enqueue(encoder.encode(delta))
        } catch {
          // Same as above — partial JSON mid-chunk is expected, not an error.
        }
      }
    },
  })
}

// ── Shared base: complete() is just stream() read to the end ────────────

abstract class BaseAIGateway implements AIGateway {
  abstract stream(messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>>

  async complete(messages: AIMessage[], options?: AICompleteOptions): Promise<string> {
    const stream = await this.stream(messages, options)
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let text = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  }
}

// ── OpenAI-compatible providers (Groq, OpenAI, Ollama) ───────────────────
// All three speak the same /chat/completions shape, so they share the
// actual request logic; only base URL, auth, model names, and the label
// used in error messages differ per subclass.

abstract class OpenAICompatibleGateway extends BaseAIGateway {
  protected abstract baseUrl: string
  protected abstract apiKey: string | null
  protected abstract simpleModel: string
  protected abstract complexModel: string
  protected abstract providerLabel: string

  async stream(messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>> {
    const model = isComplex(messages, options) ? this.complexModel : this.simpleModel
    return this.request(model, messages, options)
  }

  protected async request(model: string, messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
          ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
    } catch {
      throw new AIGatewayError(`network error contacting ${this.providerLabel}`, ERR_NETWORK)
    }

    if (res.status === 429) throw new AIGatewayError(`${this.providerLabel} rate limited`, ERR_RATE_LIMIT)
    if (!res.ok) throw new AIGatewayError(`${this.providerLabel} API error ${res.status}: ${await res.text().catch(() => '')}`, ERR_API)
    if (!res.body) throw new AIGatewayError(`${this.providerLabel} response has no body`, ERR_API)

    return res.body.pipeThrough(createOpenAICompatibleSSETransform())
  }
}

const GROQ_COMPLEX_FALLBACK_MODEL = 'llama-3.3-70b-versatile'

class GroqGateway extends OpenAICompatibleGateway {
  protected baseUrl = 'https://api.groq.com/openai/v1'
  protected apiKey = process.env.GROQ_API_KEY ?? null
  protected simpleModel = 'llama-3.1-8b-instant'
  // qwen3-27b is a newer Groq deployment — if it's ever renamed/retired,
  // fall back to a known-stable large model rather than failing outright.
  protected complexModel = 'qwen/qwen3-27b'
  protected providerLabel = 'Groq'

  async stream(messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>> {
    if (!this.apiKey) throw new AIGatewayError('GROQ_API_KEY missing', ERR_API)
    const complex = isComplex(messages, options)
    const model = complex ? this.complexModel : this.simpleModel
    try {
      return await this.request(model, messages, options)
    } catch (e) {
      if (complex && model !== GROQ_COMPLEX_FALLBACK_MODEL) {
        try {
          return await this.request(GROQ_COMPLEX_FALLBACK_MODEL, messages, options)
        } catch {
          throw e // surface the original failure's message, not the fallback's
        }
      }
      throw e
    }
  }
}

class OpenAIGateway extends OpenAICompatibleGateway {
  protected baseUrl = 'https://api.openai.com/v1'
  protected apiKey = process.env.OPENAI_API_KEY ?? null
  protected simpleModel = 'gpt-4o-mini'
  protected complexModel = 'gpt-4o'
  protected providerLabel = 'OpenAI'

  async stream(messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>> {
    if (!this.apiKey) throw new AIGatewayError('OPENAI_API_KEY missing', ERR_API)
    return super.stream(messages, options)
  }
}

class OllamaGateway extends OpenAICompatibleGateway {
  protected baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '') + '/v1'
  protected apiKey = null // local server, no auth
  protected simpleModel = process.env.OLLAMA_MODEL ?? 'llama3.1'
  protected complexModel = process.env.OLLAMA_MODEL ?? 'llama3.1'
  protected providerLabel = 'Ollama'
}

// ── Gemini (different request/response shape entirely) ──────────────────

class GeminiGateway extends BaseAIGateway {
  private apiKey = process.env.GEMINI_API_KEY ?? null
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
  private model = 'gemini-2.0-flash'

  async stream(messages: AIMessage[]): Promise<ReadableStream<Uint8Array>> {
    if (!this.apiKey) throw new AIGatewayError('GEMINI_API_KEY missing', ERR_API)

    const systemText = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
    const conversation = messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      contents: conversation.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    }
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] }

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new AIGatewayError('network error contacting Gemini', ERR_NETWORK)
    }

    if (res.status === 429) throw new AIGatewayError('Gemini rate limited', ERR_RATE_LIMIT)
    if (!res.ok) throw new AIGatewayError(`Gemini API error ${res.status}: ${await res.text().catch(() => '')}`, ERR_API)
    if (!res.body) throw new AIGatewayError('Gemini response has no body', ERR_API)

    return res.body.pipeThrough(createGeminiSSETransform())
  }
}

// ── Default-system-message wrapper ───────────────────────────────────────
// Prepends DEFAULT_SYSTEM_MESSAGE ahead of whatever system message(s) the
// caller supplies, for every provider. Multiple system-role messages are
// already handled fine downstream — the OpenAI-compatible providers just
// forward the array as-is (the API reads them in order), and Gemini's
// request builder concatenates every system-role message into one
// systemInstruction (see createGeminiSSETransform's caller above).
class GuardedAIGateway implements AIGateway {
  constructor(private inner: AIGateway) {}

  private withDefault(messages: AIMessage[]): AIMessage[] {
    return [{ role: 'system', content: DEFAULT_SYSTEM_MESSAGE }, ...messages]
  }

  stream(messages: AIMessage[], options?: AICompleteOptions): Promise<ReadableStream<Uint8Array>> {
    return this.inner.stream(this.withDefault(messages), options)
  }

  complete(messages: AIMessage[], options?: AICompleteOptions): Promise<string> {
    return this.inner.complete(this.withDefault(messages), options)
  }
}

// ── Factory ────────────────────────────────────────────────────────────

export function createAIGateway(): AIGateway {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase()
  const inner = (() => {
    switch (provider) {
      case 'gemini': return new GeminiGateway()
      case 'openai': return new OpenAIGateway()
      case 'ollama': return new OllamaGateway()
      case 'groq':
      default:
        return new GroqGateway()
    }
  })()
  return new GuardedAIGateway(inner)
}
