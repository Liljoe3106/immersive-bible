/* Immersive Bible SW: tiered cache. Never precache full chamber videos on first visit. */
const VERSION = 'ib-v1'
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/chamber/poster.jpg',
  '/chamber/bed.mp3',
  '/chamber/page-turn.mp3',
  '/chamber/parchment.jpg',
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
