import { NextRequest, NextResponse } from 'next/server.js'

import {
  ADMIN_HOST,
  MARKETING_HOST,
  PLATFORM_HOST,
  normalizeHostname,
  siteSurfaceForHost,
  type SiteSurface,
} from './lib/site-hosts.ts'

type RouteSurface = SiteSurface | 'shared-auth' | 'shared' | null

const ADMIN_PAGE_PREFIXES = ['/admin', '/director', '/finance', '/manager', '/teacher', '/math/admin']
const PLATFORM_PAGE_PREFIXES = ['/student', '/onboarding', '/offline', '/math/student', '/math/parent']
const ADMIN_API_PREFIXES = [
  '/api/admin',
  '/api/block-user',
  '/api/create-user',
  '/api/delete-user',
  '/api/list-users',
]
const PLATFORM_API_PREFIXES = ['/api/ai-mentor', '/api/practice', '/api/offline-student', '/api/delete-own-account']

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function routeSurface(pathname: string): RouteSurface {
  if (pathname === '/api/health') return 'shared'
  if (ADMIN_API_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return 'admin'
  if (PLATFORM_API_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return 'platform'
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
  // the canonical apex URL, platform runs the session/onboarding router, and
  // admin starts at its dedicated login page.
  if (pathname === '/') {
    if (surface === 'marketing') {
      const target = request.nextUrl.clone()
      target.pathname = '/landing'
      return withSurfaceHeaders(NextResponse.rewrite(target), surface)
    }
    if (surface === 'admin') {
      return withSurfaceHeaders(redirectTo(request, ADMIN_HOST, '/login'), surface)
    }
    return withSurfaceHeaders(NextResponse.next(), surface)
  }

  const requiredSurface = routeSurface(pathname)
  if (requiredSurface === 'shared') return withSurfaceHeaders(NextResponse.next(), surface)

  if (requiredSurface === 'shared-auth') {
    if (surface === 'marketing') {
      return withSurfaceHeaders(redirectTo(request, PLATFORM_HOST), surface)
    }
    return withSurfaceHeaders(NextResponse.next(), surface)
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
