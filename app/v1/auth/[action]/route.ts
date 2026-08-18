import { NextRequest, NextResponse } from 'next/server'

import { forwardTrustedClientIp } from '../../../../lib/trusted-client-ip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY_BYTES = 64_000
const METHODS = {
  login: 'POST',
  refresh: 'POST',
  logout: 'POST',
  me: 'GET',
} as const

type AuthAction = keyof typeof METHODS

function internalApiOrigin(): string {
  const value = process.env.ZHANGAK_API_INTERNAL_URL ?? 'http://127.0.0.1:3210'
  const url = new URL(value)
  const port = Number(url.port)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1'
    || !Number.isSafeInteger(port) || port < 1 || port > 65_535
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ZHANGAK_API_INTERNAL_URL must be an explicit http://127.0.0.1:<port> origin')
  }
  return url.origin
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  for (const name of ['content-type', 'cache-control', 'x-content-type-options', 'x-release-sha']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const cookies = getSetCookie?.call(upstream.headers) ?? []
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return headers
}

async function proxyAuth(request: NextRequest, actionValue: string): Promise<NextResponse> {
  const action = actionValue as AuthAction
  if (!Object.hasOwn(METHODS, action) || request.method !== METHODS[action]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Запрос слишком большой', code: 'payload_too_large' }, { status: 413 })
  }

  const body = request.method === 'GET' ? undefined : await request.arrayBuffer()
  if (body && body.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Запрос слишком большой', code: 'payload_too_large' }, { status: 413 })
  }

  const headers = new Headers()
  for (const name of ['accept', 'authorization', 'content-type', 'cookie', 'origin', 'user-agent']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  forwardTrustedClientIp(request.headers, headers)

  try {
    const upstream = await fetch(`${internalApiOrigin()}/v1/auth/${action}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream),
    })
  } catch {
    return NextResponse.json(
      { error: 'Сервис временно недоступен', code: 'backend_unavailable' },
      { status: 503 },
    )
  }
}

type RouteContext = { params: Promise<{ action: string }> }

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyAuth(request, (await context.params).action)
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyAuth(request, (await context.params).action)
}
