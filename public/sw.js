// Pulse CRM service worker.
// Only the app shell (HTML, JS, CSS, icons) is cached. Supabase API, auth and any other
// cross-origin requests are never intercepted, so login and live data always hit the network.
// Bump VERSION to force old caches to be cleared.
const VERSION = 'v1'
const SHELL_CACHE = `pulse-shell-${VERSION}`
const ASSET_CACHE = `pulse-assets-${VERSION}`
const MAX_ASSETS = 60

const SHELL = ['/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const trim = async (cacheName, max) => {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Leave writes, Supabase, Google Fonts and every other origin to the browser.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Page loads: always try the network first so users get the latest deploy;
  // fall back to the cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Vite's hashed build files never change, so cache-first is safe.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches
                .open(ASSET_CACHE)
                .then((c) => c.put(request, copy))
                .then(() => trim(ASSET_CACHE, MAX_ASSETS))
            }
            return res
          })
      )
    )
    return
  }

  // Icons, manifest, favicon: serve from cache, refresh in the background.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(SHELL_CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
