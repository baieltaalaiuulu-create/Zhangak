import { NextRequest, NextResponse } from 'next/server.js'

import {
  ADMIN_HOST,
  MARKETING_HOST,
  PLATFORM_HOST,
  normalizeHostname,
  siteSurfaceForHost,
  type SiteSurface,
} from './lib/site-hosts.ts'

type RouteSurface = SiteSurface | 'shared-auth' | 'workspace-auth-api' | 'retired-api' | 'shared' | null

const ADMIN_PAGE_PREFIXES = ['/admin', '/director', '/finance', '/manager', '/math/admin']
const PLATFORM_PAGE_PREFIXES = ['/student', '/teacher', '/onboarding', '/offline', '/math/student', '/math/parent']
// These paths were Supabase-backed Next route handlers.  The mounted product
// flows now use the first-party `/v1/platform` and `/v1/admin` BFF routes.
// Keep an explicit deny-list while old bookmarks, clients or probes exist so
// they always receive a uniform 404 instead of reaching a future catch-all.
const RETIRED_LEGACY_API_PREFIXES = [
  '/api/admin',
  '/api/block-user',
  '/api/create-user',
  '/api/delete-user',
  '/api/list-users',
  '/api/delete-own-account',
  '/api/ai-mentor',
  '/api/practice',
  '/api/teacher',
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function routeSurface(pathname: string): RouteSurface {
  if (pathname === '/api/health') return 'shared'
  if (matchesPrefix(pathname, '/v1/auth')) return 'workspace-auth-api'
  // First-party product APIs are deliberately namespace-scoped. The Next BFF
  // forwards them only to the loopback Node API, while this host gate prevents
  // an admin endpoint from being called through platform.zhangak.com (and vice
  // versa). Other /v1 paths remain undiscoverable.
  if (matchesPrefix(pathname, '/v1/platform')) return 'platform'
  if (matchesPrefix(pathname, '/v1/admin')) return 'admin'
  if (RETIRED_LEGACY_API_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return 'retired-api'
  if (pathname === '/login') return 'shared-auth'
  if (pathname === '/sw.js' || pathname === '/platform.webmanifest') return 'platform'
  if (ADMIN_PAGE_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return 'admin'
  if (PLATFORM_PAGE_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return 'platform'
  if (pathname === '/' || pathname === '/landing' || pathname === '/math' || pathname === '/privacy' || pathname === '/sitemap.xml') {
    return 'marketing'
  }
  return null
}

function hostForSurface(surface: SiteSurface): string {
  if (surface === 'admin') return ADMIN_HOST
  if (surface === 'platform') return PLATFORM_HOST
  return MARKETING_HOST
}

function withSurfaceHeaders(response: NextResponse, surface: SiteSurface): NextResponse {
  response.headers.set('Vary', 'Host')
  if (surface !== 'marketing') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
  return response
}

function redirectTo(request: NextRequest, host: string, pathname = request.nextUrl.pathname): NextResponse {
  const target = request.nextUrl.clone()
  target.protocol = 'https:'
  target.hostname = host
  target.port = ''
  target.pathname = pathname
  return NextResponse.redirect(target, 308)
}

function internalRewrite(request: NextRequest, pathname: string): NextResponse {
  const target = request.nextUrl.clone()

  // In the standalone server, TLS is terminated by Nginx and Next receives a
  // loopback URL whose protocol reflects X-Forwarded-Proto. Rewriting that
  // HTTPS URL would make Next proxy back to its plaintext port with TLS. Keep
  // public origins untouched (including previews), but always use HTTP for
  // the local upstream that actually serves the process.
  if (['localhost', '127.0.0.1', '::1'].includes(target.hostname)) {
    target.protocol = 'http:'
  }

  target.pathname = pathname
  return NextResponse.rewrite(target)
}

function wrongApiSurface(surface: SiteSurface): NextResponse {
  return withSurfaceHeaders(
    NextResponse.json({ error: 'Not found' }, { status: 404 }),
    surface,
  )
}

function robotsResponse(surface: SiteSurface): NextResponse {
  const body = surface === 'marketing'
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /student/',
        'Disallow: /api/',
        '',
        `Sitemap: https://${MARKETING_HOST}/sitemap.xml`,
        `Host: ${MARKETING_HOST}`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n')
  return withSurfaceHeaders(new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  }), surface)
}

export function proxy(request: NextRequest): NextResponse {
  const rawHost = request.headers.get('host') ?? request.nextUrl.host
  const hostname = normalizeHostname(rawHost)
  const surface = siteSurfaceForHost(hostname)

  // Local development, preview hosts and direct-IP health checks retain the
  // ordinary filesystem routing. Domain separation applies only to the three
  // production hosts we explicitly own.
  if (!surface) return NextResponse.next()

  if (hostname === `www.${MARKETING_HOST}`) {
    return withSurfaceHeaders(redirectTo(request, MARKETING_HOST), 'marketing')
  }

  const { pathname } = request.nextUrl
  if (pathname === '/robots.txt') return robotsResponse(surface)

  // Every host owns its root entry: marketing renders the landing page at
  // the canonical apex URL, while both private workspaces start at a login
  // page whose content is tailored to that host. Authenticated users are
  // redirected to their workspace by the login page itself.
  if (pathname === '/') {
    if (surface === 'marketing') {
      return withSurfaceHeaders(internalRewrite(request, '/landing'), surface)
    }
    // The platform root is a client-side first-visit gate. It checks the
    // HttpOnly session and only then chooses the skippable onboarding or
    // login screen; redirecting here would make /onboarding unreachable.
    if (surface === 'platform') return withSurfaceHeaders(NextResponse.next(), surface)
    return withSurfaceHeaders(redirectTo(request, hostForSurface(surface), '/login'), surface)
  }

  const requiredSurface = routeSurface(pathname)
  if (requiredSurface === 'shared') return withSurfaceHeaders(NextResponse.next(), surface)

  // The old Supabase-backed App Router endpoints are deliberately retired.
  // Returning here makes their absence a stable API contract on every owned
  // host (rather than relying on the filesystem's default 404 response).
  if (requiredSurface === 'retired-api') return wrongApiSurface(surface)

  if (requiredSurface === 'shared-auth') {
    if (surface === 'marketing') {
      return withSurfaceHeaders(redirectTo(request, PLATFORM_HOST), surface)
    }
    return withSurfaceHeaders(NextResponse.next(), surface)
  }

  if (requiredSurface === 'workspace-auth-api') {
    return surface === 'marketing'
      ? wrongApiSurface(surface)
      : withSurfaceHeaders(NextResponse.next(), surface)
  }

  if (requiredSurface && requiredSurface !== surface) {
    if (pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) {
      return wrongApiSurface(surface)
    }
    return withSurfaceHeaders(redirectTo(request, hostForSurface(requiredSurface)), surface)
  }

  if (surface === 'marketing' && pathname === '/landing') {
    return withSurfaceHeaders(redirectTo(request, MARKETING_HOST, '/'), surface)
  }

  return withSurfaceHeaders(NextResponse.next(), surface)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons/|images/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|woff|woff2)$).*)',
  ],
}
