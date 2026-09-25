import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppStore } from '../lib/store'
import { formatRef } from '../lib/bible/books'
import {
  bindAmbientGesture,
  duckAmbient,
  startAmbient,
  setAmbientMuted,
  unduckAmbient,
} from '../lib/ambient'
import { useAmbientSound } from '../hooks/use-ambient-label'

const HOME_SRC = '/chamber/home.mp4?v=v3c1'
const OPEN_SRC = '/chamber/open.mp4?v=stills4'
const POSTER = '/chamber/poster.jpg?v=v3c1'
/** Network paths (cache-bust). Prefer blob object URLs once prefetched. */
const OPEN_STILLS_PATHS = {
  closed: '/chamber/open-stills/closed-best.jpg?v=stills4',
  half: '/chamber/open-stills/half-best.jpg?v=stills4',
  open: '/chamber/open-stills/open-best.jpg?v=stills4',
  parchment: '/chamber/open-stills/blank-parchment-best.jpg?v=stills4',
} as const
/** Start the back home clip this far before the front ends. */
const HOME_XFADE_LEAD_S = 1.65
/** Match .chamber-video-home opacity transition. */
const HOME_XFADE_MS = 1600
/** Max ritual wall-clock once open film or stills have started. */
const FAILSAFE_MS = 20000
/** If blob open video stuck on first frame after play begun. */
const STUCK_FRAME_MS = 1500
/** If currentTime never advances after play() → stills. */
const STUCK_ZERO_MS = 800
const VEIL_LEAD_S = 0.9
/** Match .chamber-veil transition (850ms) + small settle so nav is fully opaque. */
const NAV_AFTER_VEIL_MS = 900
const VEIL_TRANSITION_MS = 850
/** Cream-only fallback when neither open blob nor stills are available. */
const CREAM_ONLY_MS = 700
/** Hard-cut stills timings (full ritual). Closed brief — looks like home video. */
const STILL_CLOSED_MS = 350
const STILL_HALF_MS = 1000
const STILL_OPEN_MS = 3400
const STILL_PARCHMENT_MS = 3000
const STILL_FLASH_MS = 200
/** Short hard-cut timings under prefers-reduced-motion (no CSS zoom). */
const STILL_RM_CLOSED_MS = 200
const STILL_RM_HALF_MS = 450
const STILL_RM_OPEN_MS = 700
const STILL_RM_PARCHMENT_MS = 550
const STILL_RM_FLASH_MS = 120
/** Dual-home B after idle if blob never arrives. */
const HOME_B_IDLE_MS = 8000

type StillFrame = 'closed' | 'half' | 'open' | 'parchment'
type StillUrlMap = Record<StillFrame, string>

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Resolve only on successful decode — never treat onerror as ready. */
function loadImageOk(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

async function fetchImageBlobUrl(
  src: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(src, { signal, cache: 'force-cache' })
  if (!res.ok) throw new Error(`still fetch ${res.status}`)
  const buf = await res.arrayBuffer()
  const blob = new Blob([buf], { type: 'image/jpeg' })
  const url = URL.createObjectURL(blob)
  const ok = await loadImageOk(url)
  if (!ok) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* */
    }
    throw new Error('still decode failed')
  }
  return url
}

export function Chamber() {
  const navigate = useNavigate()
  const place = useAppStore((s) => s.place)
  const audioMuted = useAppStore((s) => s.audioMuted)
  const touchDay = useAppStore((s) => s.touchDay)
  const setLayoutMode = useAppStore((s) => s.setLayoutMode)
  const chamberResumeAt = useAppStore((s) => s.chamberResumeAt)
  const setChamberResumeAt = useAppStore((s) => s.setChamberResumeAt)
  const { label: soundLabel, toggle: toggleSound, active: soundActive } = useAmbientSound()

  const homeRef = useRef<HTMLVideoElement>(null)
  const homeBRef = useRef<HTMLVideoElement>(null)
  const homeFrontRef = useRef(0)
  const homeFadingRef = useRef(false)
  const openRef = useRef<HTMLVideoElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const [opening, setOpening] = useState(false)
  const [veil, setVeil] = useState(false)
  const [openVisible, setOpenVisible] = useState(false)
  const [homeQ, setHomeQ] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [, setMediaReady] = useState(false)
  const [openReady, setOpenReady] = useState(false)
  const [stillsReady, setStillsReady] = useState(false)
  const [idleDim, setIdleDim] = useState(false)
  const [homeFront, setHomeFront] = useState(0)
  const [allowHomeB, setAllowHomeB] = useState(false)
  const [homeSrcActive, setHomeSrcActive] = useState(false)
  const [openBlobUrl, setOpenBlobUrl] = useState<string | null>(null)
  const [stillUrls, setStillUrls] = useState<StillUrlMap | null>(null)
  const [stillsActive, setStillsActive] = useState(false)
  const [stillFrame, setStillFrame] = useState<StillFrame | null>(null)
  const [stillFlash, setStillFlash] = useState(false)
  const [reducedMotion] = useState(() => prefersReducedMotion())
  const navigated = useRef(false)
  const openStarted = useRef(false)
  const openPlayBegun = useRef(false)
  const ritualShown = useRef(false)
  const stillsStarted = useRef(false)
  const failsafeTimer = useRef(0)
  const stillsTimers = useRef<number[]>([])
  const openBlobUrlRef = useRef<string | null>(null)
  const stillBlobUrlsRef = useRef<string[]>([])
  const stillUrlsRef = useRef<StillUrlMap | null>(null)

  const visibleHome = () =>
    homeFrontRef.current === 1 ? homeBRef.current : homeRef.current

  const pauseBothHomes = () => {
    for (const h of [homeRef.current, homeBRef.current]) {
      if (!h) continue
      try {
        h.pause()
      } catch {
        /* */
      }
    }
  }

  const clearStillsTimers = () => {
    for (const id of stillsTimers.current) window.clearTimeout(id)
    stillsTimers.current = []
  }

  const armFailsafe = () => {
    if (failsafeTimer.current) return
    failsafeTimer.current = window.setTimeout(() => {
      goRead()
    }, FAILSAFE_MS)
  }

  const markRitualShown = () => {
    if (ritualShown.current) return
    ritualShown.current = true
    armFailsafe()
  }

  useEffect(() => {
    touchDay()
    setAmbientMuted(audioMuted)
    startAmbient()
    bindAmbientGesture()
  }, [audioMuted, touchDay])

  // Prefetch open.mp4 + open-stills as Blobs — never assign network OPEN_SRC to <video>.
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const ac = new AbortController()

    const runOpen = async () => {
      try {
        const res = await fetch(OPEN_SRC, { signal: ac.signal, cache: 'force-cache' })
        if (!res.ok) throw new Error(`open fetch ${res.status}`)
        const buf = await res.arrayBuffer()
        if (cancelled) return
        const blob = new Blob([buf], { type: 'video/mp4' })
        objectUrl = URL.createObjectURL(blob)
        openBlobUrlRef.current = objectUrl
        setOpenBlobUrl(objectUrl)
        setAllowHomeB(true)
      } catch {
        // Blob unavailable: stills path only. Do not set network src.
      }
    }
    void runOpen()

    const runStills = async () => {
      try {
        const keys = ['closed', 'half', 'open', 'parchment'] as const
        const urls = await Promise.all(
          keys.map((k) => fetchImageBlobUrl(OPEN_STILLS_PATHS[k], ac.signal)),
        )
        if (cancelled) {
          for (const u of urls) {
            try {
              URL.revokeObjectURL(u)
            } catch {
              /* */
            }
          }
          return
        }
        const map: StillUrlMap = {
          closed: urls[0],
          half: urls[1],
          open: urls[2],
          parchment: urls[3],
        }
        stillBlobUrlsRef.current = urls
        stillUrlsRef.current = map
        setStillUrls(map)
        setStillsReady(true)
      } catch {
        // Tunnel/fetch fail: do NOT mark ready (broken imgs would look like "no change").
        if (!cancelled) setStillsReady(false)
      }
    }
    void runStills()

    // Dual-home B after idle if blob never arrives (tunnel cancel).
    const idleB = window.setTimeout(() => {
      if (!cancelled) setAllowHomeB(true)
    }, HOME_B_IDLE_MS)

    return () => {
      cancelled = true
      ac.abort()
      window.clearTimeout(idleB)
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl)
        } catch {
          /* */
        }
      }
      openBlobUrlRef.current = null
      for (const u of stillBlobUrlsRef.current) {
        try {
          URL.revokeObjectURL(u)
        } catch {
          /* */
        }
      }
      stillBlobUrlsRef.current = []
      stillUrlsRef.current = null
    }
  }, [])

  // Defer home.mp4: poster first; load video after stillsReady (or short idle).
  useEffect(() => {
    if (homeSrcActive) return
    if (stillsReady) {
      setHomeSrcActive(true)
      return
    }
    const t = window.setTimeout(() => setHomeSrcActive(true), 600)
    return () => window.clearTimeout(t)
  }, [stillsReady, homeSrcActive])

  // Soft resume / home mediaReady once src is active.
  useEffect(() => {
    if (!homeSrcActive) return
    const v = homeRef.current
    if (!v) return
    const tryAmbient = () => startAmbient()
    v.addEventListener('play', tryAmbient)
    v.addEventListener('playing', tryAmbient)
    const onReady = () => setMediaReady(true)
    if (v.readyState >= 2) setMediaReady(true)
    v.addEventListener('canplay', onReady)
    v.addEventListener('loadeddata', onReady)

    const resume = chamberResumeAt
    if (resume != null && Number.isFinite(resume) && resume > 0.2) {
      const seek = () => {
        try {
          const dur = v.duration
          if (Number.isFinite(dur) && dur > 0) {
            v.currentTime = Math.min(resume, Math.max(0, dur - 0.35))
          }
        } catch {
          /* */
        }
        void v.play().catch(() => {})
      }
      if (v.readyState >= 1) seek()
      else v.addEventListener('loadedmetadata', seek, { once: true })
    } else {
      void v.play().catch(() => {})
    }

    return () => {
      v.removeEventListener('play', tryAmbient)
      v.removeEventListener('playing', tryAmbient)
      v.removeEventListener('canplay', onReady)
      v.removeEventListener('loadeddata', onReady)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once when src activates
  }, [homeSrcActive])

  // Wire open video ONLY when blob URL is assigned (never network).
  useEffect(() => {
    const o = openRef.current
    if (!o || !openBlobUrl) {
      setOpenReady(false)
      return
    }
    const onOpenReady = () => setOpenReady(true)
    o.preload = 'auto'
    try {
      o.load()
    } catch {
      /* */
    }
    if (o.readyState >= 2) setOpenReady(true)
    o.addEventListener('canplay', onOpenReady)
    o.addEventListener('canplaythrough', onOpenReady)
    o.addEventListener('loadeddata', onOpenReady)
    return () => {
      o.removeEventListener('canplay', onOpenReady)
      o.removeEventListener('canplaythrough', onOpenReady)
      o.removeEventListener('loadeddata', onOpenReady)
    }
  }, [openBlobUrl])

  // Idle candle vignette after quiet dwell.
  useEffect(() => {
    if (opening) {
      setIdleDim(false)
      return
    }
    let t = window.setTimeout(() => setIdleDim(true), 14000)
    const bump = () => {
      setIdleDim(false)
      window.clearTimeout(t)
      t = window.setTimeout(() => setIdleDim(true), 14000)
    }
    window.addEventListener('pointerdown', bump)
    window.addEventListener('pointermove', bump)
    window.addEventListener('keydown', bump)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('pointermove', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [opening])

  // Dual home loop: no native loop. Crossfade onto a second clip near the end.
  useEffect(() => {
    if (reducedMotion || !allowHomeB || !homeSrcActive) return
    const a = homeRef.current
    const b = homeBRef.current
    if (!a || !b) return

    const layer = (i: number) => (i === 0 ? a : b)
    let fadeTimer = 0

    const startXfade = () => {
      if (homeFadingRef.current || openStarted.current) return
      const frontIdx = homeFrontRef.current
      const front = layer(frontIdx)
      const nextIdx = frontIdx === 0 ? 1 : 0
      const back = layer(nextIdx)
      homeFadingRef.current = true
      try {
        back.currentTime = 0
      } catch {
        /* */
      }
      void back.play().catch(() => {})
      homeFrontRef.current = nextIdx
      setHomeFront(nextIdx)
      window.clearTimeout(fadeTimer)
      fadeTimer = window.setTimeout(() => {
        try {
          front.pause()
          front.currentTime = 0
        } catch {
          /* */
        }
        homeFadingRef.current = false
      }, HOME_XFADE_MS + 80)
    }

    const onTime = (el: HTMLVideoElement, idx: number) => {
      if (homeFrontRef.current !== idx) return
      const dur = el.duration
      if (!Number.isFinite(dur) || dur <= 0) return
      if (dur - el.currentTime <= HOME_XFADE_LEAD_S) startXfade()
    }
    const onTimeA = () => onTime(a, 0)
    const onTimeB = () => onTime(b, 1)
    const onEndedA = () => {
      if (homeFrontRef.current === 0) startXfade()
    }
    const onEndedB = () => {
      if (homeFrontRef.current === 1) startXfade()
    }

    a.addEventListener('timeupdate', onTimeA)
    b.addEventListener('timeupdate', onTimeB)
    a.addEventListener('ended', onEndedA)
    b.addEventListener('ended', onEndedB)
    return () => {
      a.removeEventListener('timeupdate', onTimeA)
      b.removeEventListener('timeupdate', onTimeB)
      a.removeEventListener('ended', onEndedA)
      b.removeEventListener('ended', onEndedB)
      window.clearTimeout(fadeTimer)
    }
  }, [reducedMotion, allowHomeB, homeSrcActive])

  useEffect(() => {
    return () => {
      window.clearTimeout(failsafeTimer.current)
      clearStillsTimers()
    }
  }, [])

  const persistHomeTime = () => {
    const v = visibleHome()
    if (!v || opening) return
    try {
      setChamberResumeAt(v.currentTime)
    } catch {
      /* */
    }
  }

  const goRead = () => {
    if (navigated.current) return
    navigated.current = true
    window.clearTimeout(failsafeTimer.current)
    clearStillsTimers()
    setVeil(true)
    setLayoutMode('book')
    setChamberResumeAt(null)
    unduckAmbient(1200)
    const { book, chapter } = place
    const nav = () => {
      void navigate({
        to: '/read/$book/$chapter',
        params: { book, chapter: String(chapter) },
      })
    }
    const veilEl = veilRef.current
    let done = false
    const finish = () => {
      if (done) return
      done = true
      nav()
    }
    if (veilEl) {
      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== 'opacity') return
        veilEl.removeEventListener('transitionend', onEnd)
        finish()
      }
      veilEl.addEventListener('transitionend', onEnd)
    }
    window.setTimeout(finish, NAV_AFTER_VEIL_MS)
  }

  const softLeave = (to: string, search?: Record<string, string>) => {
    if (navigated.current) return
    navigated.current = true
    persistHomeTime()
    setVeil(true)
    const nav = () => {
      if (to === '/search') {
        void navigate({ to: '/search', search: search?.q ? { q: search.q } : {} })
      } else if (to === '/name') {
        void navigate({ to: '/name' })
      } else if (to === '/guide') {
        void navigate({ to: '/guide' })
      } else if (to === '/marks') {
        void navigate({ to: '/marks' })
      } else if (to === '/gallery') {
        void navigate({ to: '/gallery' })
      } else if (to === '/read') {
        void navigate({ to: '/read' })
      } else {
        void navigate({ to: '/' })
      }
    }
    window.setTimeout(nav, NAV_AFTER_VEIL_MS)
  }

  const flashThen = (next: StillFrame, flashMs: number) => {
    setStillFlash(true)
    stillsTimers.current.push(
      window.setTimeout(() => {
        setStillFrame(next)
        setStillFlash(false)
      }, flashMs),
    )
  }

  /** Cream veil beat when neither open blob nor stills are available. Never zero. */
  const runCreamOnly = () => {
    if (stillsStarted.current || navigated.current) return
    stillsStarted.current = true
    openPlayBegun.current = true
    pauseBothHomes()
    setOpenVisible(false)
    setOpening(true)
    setStillsActive(true)
    setStillFrame(null)
    setStillFlash(true)
    markRitualShown()
    setVeil(true)
    stillsTimers.current.push(
      window.setTimeout(() => goRead(), Math.max(CREAM_ONLY_MS, VEIL_TRANSITION_MS + 40)),
    )
  }

  const runStillsRitual = (opts?: { short?: boolean }) => {
    if (stillsStarted.current || navigated.current) return
    const urls = stillUrlsRef.current
    if (!urls && !stillsReady) {
      runCreamOnly()
      return
    }
    stillsStarted.current = true
    openPlayBegun.current = true // cancel video path racing in
    const short = !!opts?.short || prefersReducedMotion()
    const flashMs = short ? STILL_RM_FLASH_MS : STILL_FLASH_MS
    const closedMs = short ? STILL_RM_CLOSED_MS : STILL_CLOSED_MS
    const halfMs = short ? STILL_RM_HALF_MS : STILL_HALF_MS
    const openMs = short ? STILL_RM_OPEN_MS : STILL_OPEN_MS
    const parchMs = short ? STILL_RM_PARCHMENT_MS : STILL_PARCHMENT_MS

    pauseBothHomes()
    setOpenVisible(false)
    setOpening(true)
    setStillsActive(true)
    // Cream flash first so cut is unmistakable vs home video (closed ≈ home).
    setStillFrame(null)
    setStillFlash(true)
    markRitualShown()

    // Hide / pause open video so frozen closed frame cannot cover stills.
    const open = openRef.current
    if (open) {
      try {
        open.pause()
      } catch {
        /* */
      }
    }

    const schedule = (ms: number, fn: () => void) => {
      stillsTimers.current.push(window.setTimeout(fn, ms))
    }

    // Brief closed (≤400ms) after cream, then half → open → parchment.
    let t = flashMs
    schedule(t, () => {
      setStillFrame('closed')
      setStillFlash(false)
    })
    t += closedMs
    schedule(t, () => flashThen('half', flashMs))
    t += halfMs + flashMs
    schedule(t, () => flashThen('open', flashMs))
    t += openMs + flashMs
    schedule(t, () => flashThen('parchment', flashMs))
    t += parchMs + flashMs
    schedule(t, () => {
      setVeil(true)
      window.setTimeout(() => goRead(), VEIL_TRANSITION_MS + 40)
    })
  }

  const startOpen = () => {
    if (opening || openStarted.current) return
    // Unblocked by stills OR blob-ready open — do NOT require home.mp4.
    // If neither ready yet, Continue stays disabled (canContinue). Cream path is
    // only for mid-ritual fallback when assets vanish.
    if (!openReady && !stillsReady) return
    openStarted.current = true
    openPlayBegun.current = false
    ritualShown.current = false
    stillsStarted.current = false
    setOpening(true)
    setMoreOpen(false)
    startAmbient()
    duckAmbient(0.18, 400)

    // Reduced motion: SHORT stills ritual (hard cuts, no CSS zoom). Never instant skip.
    if (prefersReducedMotion()) {
      if (stillsReady || stillUrlsRef.current) {
        runStillsRitual({ short: true })
      } else {
        runCreamOnly()
      }
      return
    }

    const open = openRef.current
    const blobReady =
      !!openBlobUrl && !!open && open.readyState >= 2

    // Prefer blob open.mp4 when fully ready; else stills (or cream).
    if (!blobReady) {
      if (stillsReady || stillUrlsRef.current) runStillsRitual()
      else runCreamOnly()
      return
    }

    const showOpen = () => {
      if (stillsStarted.current) return
      setOpenVisible(true)
      pauseBothHomes()
      markRitualShown()
    }

    const switchToStills = () => {
      if (stillsStarted.current || navigated.current) return
      try {
        open.pause()
      } catch {
        /* */
      }
      setOpenVisible(false)
      if (stillsReady || stillUrlsRef.current) runStillsRitual()
      else runCreamOnly()
    }

    const beginOpenPlayback = () => {
      if (openPlayBegun.current || stillsStarted.current) return
      if (open.readyState < 2) {
        switchToStills()
        return
      }
      openPlayBegun.current = true
      open.loop = false
      try {
        open.currentTime = 0
      } catch {
        /* */
      }
      showOpen()
      const playP = open.play()
      if (playP && typeof playP.then === 'function') {
        playP.catch(() => {
          switchToStills()
        })
      }

      // Stuck at ~0 after play → stills.
      window.setTimeout(() => {
        if (stillsStarted.current || navigated.current) return
        if (open.currentTime < 0.05) switchToStills()
      }, STUCK_ZERO_MS)

      // Stuck first frame / paused after begun → stills.
      window.setTimeout(() => {
        if (stillsStarted.current || navigated.current) return
        if (!openPlayBegun.current) return
        if (open.paused || open.currentTime < 0.15) switchToStills()
      }, STUCK_FRAME_MS)
    }

    beginOpenPlayback()

    let veilArmed = false
    const armVeilEarly = () => {
      if (veilArmed || navigated.current || stillsStarted.current) return
      const dur = open.duration
      if (!Number.isFinite(dur) || dur <= 0) return
      if (dur - open.currentTime <= VEIL_LEAD_S) {
        veilArmed = true
        setVeil(true)
      }
    }
    const onTime = () => armVeilEarly()
    open.addEventListener('timeupdate', onTime)
    const onEnded = () => {
      if (stillsStarted.current) return
      open.removeEventListener('timeupdate', onTime)
      goRead()
    }
    open.addEventListener('ended', onEnded, { once: true })
  }

  const stopHud = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const beyondGenesisOne = !(place.book === 'gen' && place.chapter === 1)
  const ctaLabel = beyondGenesisOne
    ? `Continue ${formatRef(place.book, place.chapter)}`
    : 'Begin at Genesis'

  const submitHomeSearch = (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const q = homeQ.trim()
    softLeave('/search', q ? { q } : undefined)
  }

  // Continue does NOT require home.mp4 — tunnel often cancels it.
  const canContinue = openReady || stillsReady
  const homesHidden = openVisible || stillsActive

  const stillSrc =
    stillFrame && stillUrls
      ? stillUrls[stillFrame]
      : stillFrame
        ? OPEN_STILLS_PATHS[stillFrame]
        : null
  const stillZoom = stillFrame === 'open' && !reducedMotion

  return (
    <div className={`chamber-root${idleDim ? ' is-idle' : ''}`}>
      <video
        ref={homeRef}
        className={`chamber-video chamber-video-home${homeFront === 0 ? ' is-front' : ''}${homesHidden ? ' is-hidden' : ''}`}
        {...(homeSrcActive ? { src: HOME_SRC } : {})}
        poster={POSTER}
        autoPlay={homeSrcActive}
        muted
        playsInline
        loop={reducedMotion || !allowHomeB}
        preload={homeSrcActive ? 'auto' : 'none'}
        onClick={startOpen}
      />
      {!reducedMotion && allowHomeB && homeSrcActive && (
        <video
          ref={homeBRef}
          className={`chamber-video chamber-video-home${homeFront === 1 ? ' is-front' : ''}${homesHidden ? ' is-hidden' : ''}`}
          src={HOME_SRC}
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
      )}
      {/* Blob-only: never assign network OPEN_SRC — omit src until blob ready. */}
      <video
        ref={openRef}
        className={`chamber-video chamber-video-open${openVisible && !stillsActive ? ' is-on' : ''}`}
        {...(openBlobUrl ? { src: openBlobUrl } : {})}
        poster={POSTER}
        muted
        playsInline
        preload={openBlobUrl ? 'auto' : 'none'}
        aria-hidden
      />
      {stillsActive && stillSrc && (
        <img
          className={`chamber-open-still is-on${stillZoom ? ' is-zooming' : ''}`}
          src={stillSrc}
          alt=""
          draggable={false}
        />
      )}
      {stillsActive && (
        <div
          className={`chamber-still-flash${stillFlash ? ' is-on' : ''}`}
          aria-hidden
        />
      )}
      <div
        ref={veilRef}
        className={`chamber-veil${veil ? ' on' : ''}`}
        aria-hidden
      />
      <div className={`chamber-idle-vignette${idleDim ? ' on' : ''}`} aria-hidden />

      <button
        type="button"
        className={`chamber-hit${opening ? ' is-opening' : ''}`}
        aria-label="Open the book"
        onClick={startOpen}
        tabIndex={opening ? -1 : 0}
        disabled={opening || !canContinue}
      />

      <div className={`chamber-dock${opening ? ' is-opening' : ''}`} aria-hidden={opening}>
        <div className="chamber-row chamber-topbar" onClick={stopHud}>
          <div className="chamber-brand">
            The <span>Immersive</span> Bible
          </div>
          <button
            type="button"
            className={`chamber-ghost${soundActive ? ' active' : ''}`}
            title="Heart of Nowhere (Kevin MacLeod, CC BY 3.0)"
            onClick={(e) => {
              e.stopPropagation()
              toggleSound()
            }}
          >
            {soundLabel}
          </button>
        </div>

        <div className="chamber-room" onClick={stopHud}>
          <p className="chamber-room-label">The Room</p>
          <h1 className="chamber-room-headline">Open the book.</h1>
          <p className="chamber-room-line">
            Candle light. A closed codex. Choose a scripture: the book opens to that page.
          </p>

          <div className="chamber-row" style={{ marginTop: '0.85rem' }}>
            <button
              type="button"
              className="chamber-ghost chamber-primary"
              disabled={!canContinue && !opening}
              aria-disabled={!canContinue && !opening}
              onClick={(e) => {
                e.stopPropagation()
                startOpen()
              }}
            >
              {canContinue || opening ? ctaLabel : 'Preparing…'}
            </button>
            <button
              type="button"
              className={`chamber-ghost${moreOpen ? ' active' : ''}`}
              aria-expanded={moreOpen}
              onClick={(e) => {
                e.stopPropagation()
                setMoreOpen((v) => !v)
              }}
            >
              More
            </button>
          </div>

          {moreOpen && (
            <div className="chamber-more" onClick={stopHud}>
              <form className="chamber-home-search" onSubmit={submitHomeSearch}>
                <input
                  className="chamber-home-input"
                  value={homeQ}
                  onChange={(e) => setHomeQ(e.target.value)}
                  placeholder="John 1:1, mercy, or what you are in…"
                  aria-label="Search from the room"
                />
              </form>
              <div className="chamber-row" style={{ marginTop: '0.55rem' }}>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    softLeave('/search')
                  }}
                >
                  Search
                </button>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    softLeave('/name')
                  }}
                >
                  Name it
                </button>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    softLeave('/marks')
                  }}
                >
                  Marks
                </button>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    softLeave('/gallery')
                  }}
                >
                  Original
                </button>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    softLeave('/guide')
                  }}
                >
                  Guide
                </button>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    softLeave('/read')
                  }}
                >
                  Read
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
