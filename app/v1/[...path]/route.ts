import { NextRequest, NextResponse } from 'next/server'

import { forwardTrustedClientIp } from '../../../lib/trusted-client-ip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The browser never reaches the API process directly: it remains bound to
// loopback.  This BFF only transports explicitly namespaced first-party API
// routes and forwards the HttpOnly session cookie to that local process.
//
// `auth` has a dedicated route because it has a narrower body limit and its
// response may rotate cookies.  Product endpoints must live under either
// /v1/platform/* or /v1/admin/* and authenticate/authorize themselves in the
// Node API; this route is deliberately not a generic upstream proxy.
const MAX_BODY_BYTES = 512_000
const METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE'])
const SURFACES = new Set(['platform', 'admin'])
const PATH_SEGMENT = /^[a-z0-9-]+$/

function internalApiOrigin(): string {
  const value = process.env.ZHANGAK_API_INTERNAL_URL ?? 'http://127.0.0.1:3210'
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '3210'
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ZHANGAK_API_INTERNAL_URL must be http://127.0.0.1:3210')
  }
  return url.origin
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  for (const name of ['content-type', 'cache-control', 'etag', 'x-content-type-options', 'x-release-sha']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  for (const cookie of getSetCookie?.call(upstream.headers) ?? []) headers.append('set-cookie', cookie)
  return headers
}

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxyApi(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params
  const [surface, ...rest] = path
  if (!METHODS.has(request.method) || !surface || !SURFACES.has(surface)
    || rest.length === 0 || rest.some(segment => !PATH_SEGMENT.test(segment))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Запрос слишком большой', code: 'payload_too_large' }, { status: 413 })
  }

  const body = ['GET', 'DELETE'].includes(request.method) ? undefined : await request.arrayBuffer()
  if (body && body.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Запрос слишком большой', code: 'payload_too_large' }, { status: 413 })
  }

  const headers = new Headers()
  for (const name of ['accept', 'authorization', 'content-type', 'cookie', 'origin', 'user-agent', 'if-none-match']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  forwardTrustedClientIp(request.headers, headers)

  try {
    const upstream = await fetch(`${internalApiOrigin()}/v1/${path.join('/')}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
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

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyApi(request, context)
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyApi(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyApi(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyApi(request, context)
}
