/* Immersive Bible SW: tiered cache. Never precache full chamber videos on first visit.
 * Paths are relative to the SW location so GitHub Pages project base works. */
const VERSION = 'ib-v3'
const BASE = self.location.pathname.replace(/\/[^/]*$/, '/')
const PRECACHE = [
  BASE,
  BASE + 'manifest.webmanifest',
  BASE + 'favicon.svg',
  BASE + 'apple-touch-icon.png',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'icon-192-maskable.png',
  BASE + 'icon-512-maskable.png',
  BASE + 'chamber/poster.jpg',
  BASE + 'chamber/bed.mp3',
  BASE + 'chamber/page-turn.mp3',
  BASE + 'chamber/parchment.jpg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

function isVideo(url) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/chamber/home') || url.includes('/chamber/open')
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = req.url
  // Never cache-intercept large videos on first visit; network only.
  if (isVideo(url)) return

  // Critical JSON / static: stale-while-revalidate
  if (url.includes('/data/') || url.includes('/chamber/')) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached)),
  )
})
