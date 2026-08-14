import { isIP } from 'node:net'

/**
 * The Next.js BFF is loopback-only. Nginx overwrites X-Real-IP with the TCP
 * peer address, so forwarding that single value avoids trusting a browser-
 * supplied X-Forwarded-For chain.
 */
export function forwardTrustedClientIp(requestHeaders: Headers, upstreamHeaders: Headers): void {
  const realIp = requestHeaders.get('x-real-ip')?.trim()
  if (realIp && isIP(realIp) !== 0) {
    upstreamHeaders.set('x-forwarded-for', realIp)
  }
}
