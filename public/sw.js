// Zhangak service worker — basic offline support.
//
// Scope is intentionally conservative: this app is a dynamic, auth-gated
// Supabase-backed dashboard, not a static site, so we don't try to cache
// API responses or run an offline-first strategy everywhere. We only:
//   1. Precache a handful of static shell assets on install.
//   2. Serve pages network-first (so logged-in users always see fresh
//      data when online), falling back to cache, then to /offline.
//   3. Serve same-origin static assets (JS/CSS/images/icons) cache-first
//      for speed, updating the cache in the background.
// Cross-origin requests (Supabase, etc.) are never intercepted.

const CACHE_VERSION = 'zhangak-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('zhangak-') && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Page navigations: always prefer the network (fresh dashboards/auth
  // state), fall back to a cached copy, and finally the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  // Static assets: serve from cache instantly if we have them, otherwise
  // fetch and cache for next time. If both fail (offline + uncached),
  // fall back to the offline page rather than a broken network error.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(OFFLINE_URL))
    })
  )
})
