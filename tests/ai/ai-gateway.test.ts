import assert from 'node:assert/strict'
import test from 'node:test'

import { createAIGateway } from '../../lib/ai-gateway.ts'

const encoder = new TextEncoder()

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return output + decoder.decode()
    output += decoder.decode(value, { stream: true })
  }
}

test('DeepSeek selects V4 Flash for simple work and V4 Pro for analysis', async () => {
  const originalFetch = globalThis.fetch
  const originalProvider = process.env.AI_PROVIDER
  const originalKey = process.env.DEEPSEEK_API_KEY
  const requests: Array<Record<string, unknown>> = []

  process.env.AI_PROVIDER = 'deepseek'
  process.env.DEEPSEEK_API_KEY = 'test-only-key'
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Готово"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(body, { status: 200 })
  }

  try {
    const gateway = createAIGateway()
    assert.equal(await readStream(await gateway.stream([{ role: 'user', content: 'Объясни дроби' }])), 'Готово')
    assert.equal(await gateway.complete(
      [{ role: 'user', content: 'Составь персональный план подготовки' }],
      { type: 'plan', jsonMode: true },
    ), 'Готово')

    assert.equal(requests[0]?.model, 'deepseek-v4-flash')
    assert.deepEqual(requests[0]?.thinking, { type: 'disabled' })
    assert.equal(requests[0]?.reasoning_effort, undefined)
    assert.equal(requests[0]?.max_tokens, 1_200)

    assert.equal(requests[1]?.model, 'deepseek-v4-pro')
    assert.deepEqual(requests[1]?.thinking, { type: 'enabled' })
    assert.equal(requests[1]?.reasoning_effort, 'high')
    assert.equal(requests[1]?.max_tokens, 2_400)
    assert.deepEqual(requests[1]?.response_format, { type: 'json_object' })
  } finally {
    globalThis.fetch = originalFetch
    if (originalProvider === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = originalProvider
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = originalKey
  }
})
