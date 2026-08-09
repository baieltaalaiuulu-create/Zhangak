// Zhangak service worker — basic offline support.
//
// Deliberately simple: this app is a dynamic, auth-gated Supabase-backed
// dashboard, not a static site, so caching stays limited to a. the offline
// shell and b. same-origin static assets (script/style/image/font). Any
// Supabase request (by hostname) or same-origin /api/* route is never
// intercepted — those always carry live/auth data and must never be served
// stale from cache.

const CACHE = 'zhangak-v3'
const STATIC = ['/', '/offline']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Supabase (any subdomain) and same-origin API routes: always network-only.
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return

  // Page navigations: network first, fall back to the offline shell.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/offline')))
    return
  }

  // Static assets: cache-first, populate the cache in the background.
  if (['script', 'style', 'image', 'font'].includes(e.request.destination)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
          return res
        })
      })
    )
  }
})
