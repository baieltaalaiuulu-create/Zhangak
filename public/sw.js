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

self.addEventListener('push', (e) => {
  let payload = {}
  try { payload = e.data ? e.data.json() : {} } catch { payload = {} }
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 80) : 'Жангак'
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Пора вернуться к подготовке.'
  const requestedUrl = typeof payload.url === 'string' ? payload.url : '/student/online/roadmap'
  const url = requestedUrl.startsWith('/student/online/') ? requestedUrl : '/student/online/roadmap'
  const tag = typeof payload.tag === 'string' ? payload.tag.slice(0, 80) : 'zhangak-reminder'
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png?v=20260813',
    badge: '/icons/icon-192.png?v=20260813',
    tag,
    renotify: false,
    data: { url },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const requestedUrl = e.notification.data && typeof e.notification.data.url === 'string'
    ? e.notification.data.url
    : '/student/online/roadmap'
  const url = requestedUrl.startsWith('/student/online/') ? requestedUrl : '/student/online/roadmap'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
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
          if (e.request.method === 'GET' && res.ok) caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()))
          return res
        })
      })
    )
  }
})
