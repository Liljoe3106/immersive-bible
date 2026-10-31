import { BASE_URL, asset } from './asset'
import { useAppStore } from './store'
import { getPlan } from './reading-plans'
import { HOME_SRC, OPEN_SRC } from './chamber-media'

/**
 * Service worker registration, the gentle "new version" prompt, and a light
 * prefetch of the current place and reading-plan days so they open offline.
 */
export function initPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    void register()
  })
}

async function register() {
  let reg: ServiceWorkerRegistration
  try {
    reg = await navigator.serviceWorker.register(`${BASE_URL}sw.js`, { scope: BASE_URL })
  } catch {
    return
  }

  const hadController = !!navigator.serviceWorker.controller
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when the reader asked for the update (or on upgrade from the old worker
    // that had been serving a stale page). A first install never reloads.
    if (refreshing || !hadController || !wantReload) return
    refreshing = true
    window.location.reload()
  })

  const offerUpdate = (w: ServiceWorker | null) => {
    if (!w || !navigator.serviceWorker.controller) return
    showUpdateToast(() => {
      wantReload = true
      w.postMessage({ type: 'SKIP_WAITING' })
    })
  }

  if (reg.waiting) offerUpdate(reg.waiting)
  reg.addEventListener('updatefound', () => {
    const w = reg.installing
    if (!w) return
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') offerUpdate(w)
    })
  })

  // Check for a new deploy when the app comes back to the foreground, and hourly.
  const check = () => {
    if (navigator.onLine) void reg.update().catch(() => {})
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.setInterval(check, 60 * 60 * 1000)

  await navigator.serviceWorker.ready
  scheduleOfflinePrefetch()
}

let wantReload = false

function showUpdateToast(onRefresh: () => void) {
  if (document.querySelector('.pwa-toast')) return
  const el = document.createElement('div')
  el.className = 'pwa-toast'
  el.setAttribute('role', 'status')
  const msg = document.createElement('span')
  msg.textContent = 'A new version is ready.'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'pwa-toast-btn'
  btn.textContent = 'Refresh'
  btn.addEventListener('click', () => {
    btn.disabled = true
    onRefresh()
  })
  const later = document.createElement('button')
  later.type = 'button'
  later.className = 'pwa-toast-later'
  later.setAttribute('aria-label', 'Later')
  later.textContent = 'Later'
  later.addEventListener('click', () => el.remove())
  el.append(msg, btn, later)
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('on'))
}

/** Warm the SW data cache with the books for where the reader is and the next plan days. */
function scheduleOfflinePrefetch() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (!navigator.onLine || conn?.saveData) return
  const run = () => {
    const s = useAppStore.getState()
    const books = new Set<string>()
    if (s.place?.book) books.add(s.place.book)
    for (const r of s.recents.slice(0, 3)) books.add(r.book)
    const plan = s.guidePlanId ? getPlan(s.guidePlanId) : undefined
    if (plan) {
      for (let d = s.guideDay; d < Math.min(plan.days.length, s.guideDay + 3); d++) {
        for (const r of plan.days[d] ?? []) books.add(r.book)
      }
    }
    // Keep the chamber clips for offline. The worker skips anything already saved,
    // and the first visit's clips were fetched before it was in control.
    const sw = navigator.serviceWorker.controller
    if (sw) {
      sw.postMessage({
        type: 'CACHE_MEDIA',
        urls: [HOME_SRC, OPEN_SRC].map((u) => new URL(u, location.href).href),
      })
    }
    for (const b of books) {
      void fetch(asset(`data/en/${b}.json`)).catch(() => {})
      void fetch(asset(`data/orig/${b}.json`)).catch(() => {})
    }
  }
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback
  if (ric) ric(run)
  else window.setTimeout(run, 3000)
}
