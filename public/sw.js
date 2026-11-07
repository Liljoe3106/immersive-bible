/* The Immersive Bible service worker.
 *
 * Caches
 *   ib-shell-<build>  app shell (index, hashed JS/CSS, core fonts, icons, chamber stills).
 *                     Filled at install from the list the build injects below. Replaced each deploy.
 *   ib-assets         other hashed /assets/ files (extra font subsets) cached on first use.
 *   ib-data           scripture JSON (data/en, data/orig, strongs, search) cached when opened.
 *                     Kept across deploys, refreshed in the background when online.
 *   ib-media          chamber videos and the ambient bed, cached in full on first play.
 *                     Capped (MEDIA_MAX_BYTES). Range requests are answered from the cached
 *                     file as proper 206 partial responses, or passed straight to the network
 *                     when not cached, so <video> and <audio> seeking keeps working.
 *
 * Paths are relative to the SW location so the GitHub Pages project base works.
 */
/** Bump SW_VERSION on releases that change app behaviour, so installed copies update. */
const SW_VERSION = 'v3-2026-11-07-plan-home'
const BUILD_ID = SW_VERSION + '-' + '__BUILD_ID__'
const PRECACHE = /*__PRECACHE__*/ []

const BASE = self.location.pathname.replace(/\/[^/]*$/, '/')
const SHELL = 'ib-shell-' + BUILD_ID
const ASSETS = 'ib-assets'
const DATA = 'ib-data'
const MEDIA = 'ib-media'
const KEEP = new Set([SHELL, ASSETS, DATA, MEDIA])
const INDEX_URL = new URL(BASE + 'index.html', self.location.origin).href

/** Only these media files are kept for offline. Everything else streams. */
const MEDIA_ALLOW = [/\/chamber\/home\.mp4$/, /\/chamber\/open-zoom\.mp4$/, /\/chamber\/open\.mp4$/, /\/chamber\/bed\.mp3$/]
const MEDIA_MAX_BYTES = 16 * 1024 * 1024
const MEDIA_MAX_FILE = 8 * 1024 * 1024

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      const urls = PRECACHE.map((p) => BASE + p)
      // cache: 'reload' skips the HTTP cache so a fresh deploy is not mixed with stale files.
      await Promise.all(
        urls.map(async (u) => {
          const res = await fetch(new Request(u, { cache: 'reload' }))
          if (!res.ok) throw new Error('precache ' + u + ' ' + res.status)
          await cache.put(u, res)
        }),
      )
      // First install, or upgrading from the old ib-v* worker that served a stale index:
      // take over straight away. Otherwise wait for the page to say so (gentle update).
      const keys = await caches.keys()
      const hasLegacy = keys.some((k) => /^ib-v\d+$/.test(k))
      const hasShell = keys.some((k) => k.startsWith('ib-shell-') && k !== SHELL)
      if (hasLegacy || !hasShell) await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable()
        } catch {
          /* */
        }
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data && event.data.type === 'CACHE_MEDIA' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      Promise.all(
        event.data.urls.map((u) => {
          const url = new URL(u, self.location.href)
          return inScope(url) && mediaAllowed(url) ? saveMediaInBackground(url) : null
        }),
      ),
    )
  }
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ build: BUILD_ID })
  }
})

function inScope(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(BASE)
}

function isMedia(url) {
  return /\.(mp4|webm|mov|m4v|mp3|m4a|ogg|wav)$/i.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (!inScope(url)) return

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(event))
    return
  }
  if (isMedia(url)) {
    event.respondWith(handleMedia(event, url))
    return
  }
  const path = url.pathname.slice(BASE.length)
  if (path.startsWith('data/')) {
    event.respondWith(staleWhileRevalidate(event, DATA))
    return
  }
  if (path.startsWith('assets/')) {
    event.respondWith(cacheFirst(req, ASSETS))
    return
  }
  // Other static files (icons, manifest, chamber stills): shell copy first, then network,
  // remembering anything new in the assets cache.
  event.respondWith(cacheFirst(req, ASSETS))
})

/** Network first so new deploys show at once; cached shell when offline. */
async function handleNavigate(event) {
  try {
    // Revalidate with the server (cheap 304 on GitHub Pages) so a new deploy shows straight
    // away instead of after the 10 minute HTTP cache.
    const res = await fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    if (res.ok) return res
    // GitHub Pages serves deep links from 404.html with status 404; that is still the app,
    // so hand it over as a normal page.
    if (res.status === 404 && (res.headers.get('content-type') || '').includes('text/html')) {
      return new Response(await res.blob(), { status: 200, headers: res.headers })
    }
    throw new Error('nav ' + res.status)
  } catch {
    const cached =
      (await caches.match(INDEX_URL)) || (await caches.match(BASE, { ignoreSearch: true }))
    if (cached) return cached
    return new Response('<!doctype html><meta charset="utf-8"><title>The Immersive Bible</title><body style="background:#0a0a08;color:#d8c9a8;font-family:serif;display:grid;place-items:center;height:100vh;margin:0"><p>You are offline. Open the app once with a connection so it can be saved for offline reading.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

/** Shell files are precached without their ?v= query; the shell is rebuilt each deploy. */
async function matchShell(req) {
  const shell = await caches.open(SHELL)
  return (await shell.match(req)) || (await shell.match(req, { ignoreSearch: true }))
}

async function cacheFirst(req, cacheName) {
  const cached = (await matchShell(req)) || (await caches.match(req))
  if (cached) return cached
  const res = await fetch(req)
  if (res && res.ok && res.type === 'basic') {
    const cache = await caches.open(cacheName)
    await cache.put(req, res.clone())
  }
  return res
}

async function staleWhileRevalidate(event, cacheName) {
  const req = event.request
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  const network = fetch(req)
    .then(async (res) => {
      if (res && res.ok && res.type === 'basic') await cache.put(req, res.clone())
      return res
    })
    .catch(() => null)
  if (cached) {
    event.waitUntil(network)
    return cached
  }
  const res = await network
  return res || Response.error()
}

/* ---------- media ---------- */

function mediaKey(url) {
  // Keyed with the ?v= query so a new video version is fetched fresh.
  return url.href
}

function mediaAllowed(url) {
  return MEDIA_ALLOW.some((re) => re.test(url.pathname))
}

async function handleMedia(event, url) {
  const req = event.request
  const range = req.headers.get('range')
  const cache = await caches.open(MEDIA)
  const cached = (await cache.match(mediaKey(url))) || (await matchShell(req))

  if (cached) {
    if (range) return rangeResponse(cached, range)
    return cached
  }

  if (!mediaAllowed(url)) return fetch(req)

  if (range) {
    // Stream this play straight from the network (real 206s), and save a full copy
    // in the background for next time / offline.
    event.waitUntil(saveMediaInBackground(url))
    return fetch(req)
  }

  // Full GET (the open ritual fetches the whole clip as a Blob): fetch once, keep a copy.
  const res = await fetch(req)
  if (res.ok && res.status === 200 && res.type === 'basic') {
    const len = Number(res.headers.get('content-length') || 0)
    if (!len || len <= MEDIA_MAX_FILE) {
      const copy = res.clone()
      event.waitUntil(putMedia(cache, mediaKey(url), copy))
    }
  }
  return res
}

const inflight = new Map()
function saveMediaInBackground(url) {
  const key = mediaKey(url)
  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    try {
      const existing = await (await caches.open(MEDIA)).match(key)
      if (existing) return
      const conn = self.navigator && self.navigator.connection
      if (conn && conn.saveData) return
      const res = await fetch(url.href, { cache: 'no-store' })
      if (!res.ok || res.status !== 200) return
      const len = Number(res.headers.get('content-length') || 0)
      if (len && len > MEDIA_MAX_FILE) return
      const cache = await caches.open(MEDIA)
      await putMedia(cache, key, res)
    } catch {
      /* offline or aborted: just stream next time */
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

async function putMedia(cache, key, res) {
  try {
    const blob = await res.blob()
    if (blob.size > MEDIA_MAX_FILE) return
    const pathname = new URL(key).pathname
    // Drop older versions of the same file (different ?v=).
    for (const r of await cache.keys()) {
      if (new URL(r.url).pathname === pathname && r.url !== key) await cache.delete(r)
    }
    await cache.put(
      key,
      new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') || blob.type || 'application/octet-stream',
          'Content-Length': String(blob.size),
          'Accept-Ranges': 'bytes',
          'X-IB-Saved': String(Date.now()),
        },
      }),
    )
    await trimMedia(cache, key)
  } catch {
    /* quota or aborted */
  }
}

async function trimMedia(cache, keepKey) {
  const entries = []
  let total = 0
  for (const r of await cache.keys()) {
    const res = await cache.match(r)
    if (!res) continue
    const size = Number(res.headers.get('content-length') || 0)
    const at = Number(res.headers.get('x-ib-saved') || 0)
    entries.push({ r, size, at })
    total += size
  }
  entries.sort((a, b) => a.at - b.at)
  for (const e of entries) {
    if (total <= MEDIA_MAX_BYTES) break
    if (e.r.url === keepKey) continue
    await cache.delete(e.r)
    total -= e.size
  }
}

async function rangeResponse(full, rangeHeader) {
  const blob = await full.blob()
  const size = blob.size
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
  if (!m) return new Response(blob, { status: 200, headers: full.headers })
  let start = m[1] === '' ? NaN : Number(m[1])
  let end = m[2] === '' ? NaN : Number(m[2])
  if (Number.isNaN(start)) {
    // suffix range: last N bytes
    const n = Number.isNaN(end) ? 0 : end
    start = Math.max(0, size - n)
    end = size - 1
  } else if (Number.isNaN(end) || end >= size) {
    end = size - 1
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  const part = blob.slice(start, end + 1)
  return new Response(part, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': full.headers.get('content-type') || 'video/mp4',
      'Content-Length': String(part.size),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  })
}
