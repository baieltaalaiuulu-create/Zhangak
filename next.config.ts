import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Gzip/brotli response compression — on by default in most hosts, but
  // explicit here since this is a bare config (no other overrides existed
  // before this).
  compress: true,

  // Not exercised by any page today (this app renders static/external
  // images with raw <img>, not next/image — see the eslint-disable
  // comments scattered through the codebase), but harmless to configure
  // now: it's a no-op until a page actually starts using next/image, and
  // then this is already in place.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },

  async headers() {
    return [
      {
        source: '/icons/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Deliberately NOT immutable/long-lived — the whole point of sw.js is
      // that the browser (and any CDN in front of it) re-checks it on every
      // load, otherwise a stale cached copy of the service worker would
      // defeat the app's own date-stamped-cache auto-update mechanism (see
      // public/sw.js and the updatefound/skipWaiting registration script
      // in app/layout.tsx).
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
