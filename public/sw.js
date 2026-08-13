// Zhangak service worker — basic offline support + auto-update.
//
// Deliberately simple: this app is a dynamic, auth-gated dashboard, not a
// static site, so caching stays limited to a. the offline
// shell and b. same-origin static assets (script/style/image/font). Any
// Same-origin API routes are never intercepted — those always carry live/auth
// data and must never be served stale from cache.
//
// The build pipeline replaces this placeholder with the immutable Git SHA,
// so every release gets its own cache even when multiple deploys share a day.
// This needs no manual version bump. Combined with the
// skipWaiting message handler + the registration script's
// updatefound/controllerchange listeners in app/layout.tsx, a newly
// deployed SW takes over and reloads the page as soon as it's installed,
// instead of waiting for every tab to be closed first.

const CACHE_VERSION = 'zhangak-v__ZHANGAK_RELEASE_SHA__'
const CACHE_NAME = CACHE_VERSION

self.addEventListener('install', (e) => {
  self.skipWaiting()
  // '/' is the platform manifest's start_url (the PWA's cold-start entry
  // point) — precached alongside '/login' and '/offline' so a launch while
  // offline still
  // gets a real, working screen instead of falling straight through to
  // the offline fallback.
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['/', '/login', '/offline'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Lets the page force this waiting worker to activate immediately (see the
// updatefound handler in app/layout.tsx) instead of sitting idle until
// every open tab on the old version closes.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // First-party API routes are always network-only.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) return

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
          caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()))
          return res
        })
      })
    )
  }
})
