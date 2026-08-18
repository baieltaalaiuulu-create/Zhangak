const MAX_JSON_BYTES = 64_000
const routes = []

export class HttpError extends Error {
  constructor(status, message, code = 'request_failed') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function route(method, pattern, handler) {
  const names = []
  const escaped = pattern.split('/').map(part => {
    if (!part.startsWith(':')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    names.push(part.slice(1))
    return '([^/]+)'
  }).join('/')
  routes.push({ method, pattern, names, regexp: new RegExp(`^${escaped}$`), handler })
}

export const GET = (pattern, handler) => route('GET', pattern, handler)
export const POST = (pattern, handler) => route('POST', pattern, handler)
export const PATCH = (pattern, handler) => route('PATCH', pattern, handler)
export const DELETE = (pattern, handler) => route('DELETE', pattern, handler)

export function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  res.end(payload)
}

function stream(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  body.once('error', () => res.destroy())
  body.pipe(res)
}

export async function readJson(req, maxBytes = MAX_JSON_BYTES) {
  const contentType = req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new HttpError(415, 'Требуется application/json', 'unsupported_media_type')
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'Запрос слишком большой', 'payload_too_large')

  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new HttpError(413, 'Запрос слишком большой', 'payload_too_large')
    chunks.push(chunk)
  }
  if (size === 0) throw new HttpError(400, 'Пустой JSON', 'invalid_json')
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required')
    return parsed
  } catch {
    throw new HttpError(400, 'Некорректный JSON', 'invalid_json')
  }
}

export function parseCookies(req) {
  const result = {}
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    try { result[key] = decodeURIComponent(value) } catch { /* ignore malformed cookie */ }
  }
  return result
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
  parts.push(`Path=${options.path ?? '/'}`)
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.secure !== false) parts.push('Secure')
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`)
  return parts.join('; ')
}

function requestIp(config, req) {
  if (config.trustProxy) {
    const forwarded = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function applyCors(config, req, res) {
  const origin = req.headers.origin?.replace(/\/$/, '')
  if (!origin) return true
  if (!config.allowedOrigins.has(origin)) return false
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')
  return true
}

function paramsFor(routeEntry, pathname) {
  const match = routeEntry.regexp.exec(pathname)
  if (!match) return null
  return Object.fromEntries(routeEntry.names.map((name, index) => {
    try { return [name, decodeURIComponent(match[index + 1])] }
    catch { throw new HttpError(400, 'Некорректный URL', 'invalid_url') }
  }))
}

export function createHandler(config) {
  return async function handler(req, res) {
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    res.setHeader('X-Release-Sha', config.releaseSha)

    if (!applyCors(config, req, res)) return json(res, 403, { error: 'Недопустимый источник', code: 'origin_forbidden' })
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '600',
      })
      return res.end()
    }

    let url
    try { url = new URL(req.url, 'http://localhost') }
    catch { return json(res, 400, { error: 'Некорректный URL', code: 'invalid_url' }) }

    // A PDF travels as a stream rather than JSON and can legitimately take
    // longer on a slow administrator connection. No other endpoint receives
    // this exception to the server's 30s deadline.
    if (req.method === 'POST' && /^\/v1\/admin\/lessons\/\d+\/materials\/upload$/.test(url.pathname)) {
      req.setTimeout(300_000)
    }

    for (const entry of routes) {
      if (entry.method !== req.method) continue
      let params
      try { params = paramsFor(entry, url.pathname) }
      catch (error) {
        const safe = error instanceof HttpError ? error : new HttpError(400, 'Некорректный URL', 'invalid_url')
        return json(res, safe.status, { error: safe.message, code: safe.code })
      }
      if (!params) continue
      try {
        const result = await entry.handler({ req, res, params, query: url.searchParams, config, ip: requestIp(config, req) })
        if (res.writableEnded) return
        const status = result?.status ?? 200
        const headers = result?.headers ?? {}
        if (result?.stream) return stream(res, status, result.stream, headers)
        return json(res, status, result?.body ?? result ?? { success: true }, headers)
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 500
        if (status >= 500) console.error('Request failed', { method: req.method, path: url.pathname, error })
        return json(res, status, {
          error: error instanceof HttpError ? error.message : 'Сервис временно недоступен',
          code: error instanceof HttpError ? error.code : 'internal_error',
        })
      }
    }
    return json(res, 404, { error: 'Не найдено', code: 'not_found' })
  }
}
