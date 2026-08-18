import 'server-only'

export class JsonBodyError extends Error {
  constructor(public readonly status: 400 | 413, message: string) {
    super(message)
  }
}

export async function readJsonObject(request: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new JsonBodyError(413, 'Запрос слишком большой')
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new JsonBodyError(413, 'Запрос слишком большой')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new JsonBodyError(400, 'Некорректный JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new JsonBodyError(400, 'Ожидался JSON-объект')
  }
  return parsed as Record<string, unknown>
}
