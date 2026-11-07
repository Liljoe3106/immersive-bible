import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppStore } from '../lib/store'
import { formatRef } from '../lib/bible/books'
import { formatDayReading, getPlan } from '../lib/reading-plans'
import {
  duckAmbient,
  startAmbient,
  unduckAmbient,
} from '../lib/ambient'
import { useAmbientSound } from '../hooks/use-ambient-label'
import { useTitle } from '../hooks/use-title'
import { asset } from '../lib/asset'
import { HOME_SRC, OPEN_SRC } from '../lib/chamber-media'

const POSTER = asset('chamber/poster.jpg?v=v3c1')
/** Network paths (cache-bust). Prefer blob object URLs once prefetched.
 * Wing frames (closed/half/open) are NEVER used in the Continue open ritual —
 * tunnel/mobile often falls back here and those look broken. Parchment only. */
const OPEN_STILLS_PATHS = {
  parchment: asset('chamber/open-stills/blank-parchment-best.jpg?v=stills4'),
} as const
/** Start the back home clip this far before the front ends. */
const HOME_XFADE_LEAD_S = 1.65
/** Match .chamber-video-home opacity transition. */
const HOME_XFADE_MS = 1600
/** Max ritual wall-clock once open film or stills have started. */
const FAILSAFE_MS = 20000
/** Stuck open video: only switch to parchment/cream if paused near t=0 after this long. */
const STUCK_PAUSED_MS = 2000
/** Wait for open-zoom before unlocking Continue via parchment alone. */
const OPEN_PREFER_WAIT_MS = 18000
/** On Continue click: wait this long for in-flight open blob before parchment/cream. */
const OPEN_CLICK_WAIT_MS = 12000
/** Match .chamber-veil transition (850ms) + small settle so nav is fully opaque. */
const NAV_AFTER_VEIL_MS = 900
const VEIL_TRANSITION_MS = 850
/** Cream-only fallback when neither open blob nor parchment still is available. */
const CREAM_ONLY_MS = 700
/** Parchment-only fallback hold (no closed/half/open wing frames). */
const STILL_PARCHMENT_MS = 900
/** Short parchment hold under prefers-reduced-motion. */
const STILL_RM_PARCHMENT_MS = 400
/** Dual-home B after idle if blob never arrives. */
const HOME_B_IDLE_MS = 8000

type StillFrame = 'parchment'
type StillUrlMap = Record<StillFrame, string>

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}


/** Capture current video frame for seamless reader underlay. */
function captureVideoFrame(video: HTMLVideoElement): string | null {
  try {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return null
  }
}

/** Solid #efe6d8 frame when video capture fails — keeps seamless goRead cream-matched. */
function creamHandoffDataUrl(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = '#efe6d8'
    ctx.fillRect(0, 0, 16, 16)
    return canvas.toDataURL('image/jpeg', 1)
  } catch {
    return ''
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
  const touchDay = useAppStore((s) => s.touchDay)
  const ritualsSeen = useAppStore((s) => s.ritualsSeen)
  const noteRitualSeen = useAppStore((s) => s.noteRitualSeen)
  const guidePlanId = useAppStore((s) => s.guidePlanId)
  const guideDay = useAppStore((s) => s.guideDay)
  const guideDone = useAppStore((s) => s.guideDone)
  const streak = useAppStore((s) => s.streak)
  const returning = ritualsSeen > 0
  const chamberResumeAt = useAppStore((s) => s.chamberResumeAt)
  const setChamberResumeAt = useAppStore((s) => s.setChamberResumeAt)
  const armReaderSettle = useAppStore((s) => s.armReaderSettle)
  const setOpenHandoffFrame = useAppStore((s) => s.setOpenHandoffFrame)
  const { label: soundLabel, toggle: toggleSound, active: soundActive } = useAmbientSound()
  useTitle(null)

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
  /** Open fetch failed — stills may unlock Continue immediately. */
  const [openFailed, setOpenFailed] = useState(false)
  /** After prefer-wait, stills alone may unlock Continue. */
  const [allowStillsContinue, setAllowStillsContinue] = useState(false)
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
  /** Where the open ritual lands. Null means the last place read. */
  const openTarget = useRef<{ book: string; chapter: number } | null>(null)
  const openStarted = useRef(false)
  const openPlayBegun = useRef(false)
  const ritualShown = useRef(false)
  const stillsStarted = useRef(false)
  const failsafeTimer = useRef(0)
  const stillsTimers = useRef<number[]>([])
  const openBlobUrlRef = useRef<string | null>(null)
  const openFailedRef = useRef(false)
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
  }, [touchDay])

  // Prefetch open.mp4 + open-stills as Blobs — never assign network OPEN_SRC to <video>.
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const ac = new AbortController()

    const runOpen = async () => {
      try {
        const res = await fetch(OPEN_SRC, { signal: ac.signal, cache: 'no-store' })
        if (!res.ok) throw new Error(`open fetch ${res.status}`)
        const buf = await res.arrayBuffer()
        if (cancelled) return
        const blob = new Blob([buf], { type: 'video/mp4' })
        objectUrl = URL.createObjectURL(blob)
        openBlobUrlRef.current = objectUrl
        setOpenBlobUrl(objectUrl)
        setAllowHomeB(true)
      } catch {
        // Blob unavailable: parchment/cream path only. Do not set network src.
        if (!cancelled) {
          openFailedRef.current = true
          setOpenFailed(true)
          setAllowStillsContinue(true)
        }
      }
    }
    void runOpen()

    const runStills = async () => {
      try {
        // Ritual fallback needs parchment only — never prefetch wing stills for display.
        const parchmentUrl = await fetchImageBlobUrl(
          OPEN_STILLS_PATHS.parchment,
          ac.signal,
        )
        if (cancelled) {
          try {
            URL.revokeObjectURL(parchmentUrl)
          } catch {
            /* */
          }
          return
        }
        const map: StillUrlMap = { parchment: parchmentUrl }
        stillBlobUrlsRef.current = [parchmentUrl]
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

    // Prefer open-zoom: only unlock Continue via parchment after wait (or open fail).
    const preferWait = window.setTimeout(() => {
      if (!cancelled) setAllowStillsContinue(true)
    }, OPEN_PREFER_WAIT_MS)

    return () => {
      cancelled = true
      ac.abort()
      window.clearTimeout(idleB)
      window.clearTimeout(preferWait)
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

  const goRead = (opts?: { seamless?: boolean }) => {
    if (navigated.current) return
    navigated.current = true
    window.clearTimeout(failsafeTimer.current)
    clearStillsTimers()
    const seamless = !!opts?.seamless
    if (!seamless) setVeil(true)
    if (ritualShown.current) noteRitualSeen()
    setChamberResumeAt(null)
    armReaderSettle()
    unduckAmbient(1200)
    const { book, chapter } = openTarget.current ?? place
    const nav = () => {
      void navigate({
        to: '/read/$book/$chapter',
        params: { book, chapter: String(chapter) },
      })
    }
    if (seamless) {
      // Last open frame already in store as underlay — navigate without cream veil.
      nav()
      return
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

  /** Cream veil beat when neither open blob nor parchment still is available. Never zero. */
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

  /** Parchment-only open ritual fallback — NEVER closed/half/open wing stills. */
  const runStillsRitual = (opts?: { short?: boolean }) => {
    if (stillsStarted.current || navigated.current) return
    const urls = stillUrlsRef.current
    if (!urls?.parchment && !stillsReady) {
      runCreamOnly()
      return
    }
    stillsStarted.current = true
    openPlayBegun.current = true // cancel video path racing in
    const short = !!opts?.short || prefersReducedMotion() || returning
    const parchMs = short ? STILL_RM_PARCHMENT_MS : STILL_PARCHMENT_MS

    pauseBothHomes()
    setOpenVisible(false)
    setOpening(true)
    setStillsActive(true)
    setStillFlash(false)
    setStillFrame('parchment')
    markRitualShown()

    // Hide / pause open video so a frozen wing frame cannot cover parchment.
    const open = openRef.current
    if (open) {
      try {
        open.pause()
      } catch {
        /* */
      }
    }

    stillsTimers.current.push(
      window.setTimeout(() => {
        // Stable network path (blob may revoke on chamber unmount).
        setOpenHandoffFrame(OPEN_STILLS_PATHS.parchment)
        goRead({ seamless: true })
      }, parchMs),
    )
  }

  /** Video failed: flat parchment or cream only — never wing frames. */
  const fallBackToStillsOrCream = () => {
    if (stillsStarted.current || navigated.current) return
    if (stillsReady || stillUrlsRef.current?.parchment) runStillsRitual()
    else runCreamOnly()
  }

  /** Skip the opening film at any point and go straight to the page. */
  const skipRitual = () => {
    if (navigated.current) return
    try {
      openRef.current?.pause()
    } catch {
      /* */
    }
    clearStillsTimers()
    stillsStarted.current = true
    goRead()
  }

  const startOpen = () => {
    if (opening || openStarted.current) return
    // Prefer openReady; parchment alone only after open fail or prefer-wait.
    const stillsOk =
      stillsReady && (openFailed || allowStillsContinue)
    if (!openReady && !stillsOk) {
      // Opening film still loading: do not make anyone wait. Go straight in.
      openStarted.current = true
      startAmbient()
      goRead()
      return
    }
    openStarted.current = true
    openPlayBegun.current = false
    ritualShown.current = false
    stillsStarted.current = false
    setOpening(true)
    setMoreOpen(false)
    startAmbient()
    duckAmbient(0.18, 400)

    // Reduced motion: SHORT parchment (or cream). Never wing stills. Never instant skip.
    if (prefersReducedMotion()) {
      if (stillsReady || stillUrlsRef.current?.parchment) {
        runStillsRitual({ short: true })
      } else if (openBlobUrlRef.current && openRef.current) {
        // No stills: shortened continuous video is fine under RM.
        void playOpenVideo()
      } else {
        runCreamOnly()
      }
      return
    }

    void playOpenVideo()
  }

  /** Video-first continuous open. Parchment/cream only if video truly unavailable. */
  const playOpenVideo = async () => {
    const isBlobReady = () => {
      const open = openRef.current
      return !!openBlobUrlRef.current && !!open && open.readyState >= 2
    }

    if (!isBlobReady()) {
      // Fetch in flight: wait up to OPEN_CLICK_WAIT_MS before parchment/cream.
      if (!openFailedRef.current) {
        const waitStart = Date.now()
        while (
          !isBlobReady() &&
          !openFailedRef.current &&
          Date.now() - waitStart < OPEN_CLICK_WAIT_MS &&
          !stillsStarted.current &&
          !navigated.current
        ) {
          await new Promise<void>((r) => window.setTimeout(r, 120))
        }
      }
      if (!isBlobReady()) {
        fallBackToStillsOrCream()
        return
      }
    }

    const open = openRef.current
    if (!open) {
      fallBackToStillsOrCream()
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
      fallBackToStillsOrCream()
    }

    let playRejects = 0
    const tryPlay = (): Promise<void> => {
      const playP = open.play()
      if (playP && typeof playP.then === 'function') {
        return playP.catch(() => {
          playRejects += 1
          if (playRejects >= 2) {
            switchToStills()
            return
          }
          return tryPlay()
        })
      }
      return Promise.resolve()
    }

    if (openPlayBegun.current || stillsStarted.current) return
    if (open.readyState < 2) {
      switchToStills()
      return
    }
    openPlayBegun.current = true
    open.loop = false
    try {
      open.currentTime = 0
      // Returning readers get a shorter opening.
      open.playbackRate = returning ? 2 : 1
    } catch {
      /* */
    }
    showOpen()
    void tryPlay()

    // Soft stuck check: only if paused AND near t=0 after 2s.
    // Never yank a playing video that has advanced into JPEG stills.
    window.setTimeout(() => {
      if (stillsStarted.current || navigated.current) return
      if (!openPlayBegun.current) return
      if (open.paused && open.currentTime < 0.05) switchToStills()
    }, STUCK_PAUSED_MS)

    let handoffArmed = false
    const captureHandoff = (force = false, allowCreamFallback = false) => {
      if (navigated.current || stillsStarted.current) return
      if (handoffArmed && !force) return
      // Prefer the solid-cream tail frame; fall back to #efe6d8 so seamless never flashes veil.
      const url = captureVideoFrame(open) || (allowCreamFallback ? creamHandoffDataUrl() : null)
      if (!url) return
      handoffArmed = true
      setOpenHandoffFrame(url)
    }
    const armHandoffEarly = () => {
      if (navigated.current || stillsStarted.current) return
      const dur = open.duration
      if (!Number.isFinite(dur) || dur <= 0) return
      // Capture only in the solid-cream hold (not mid-zoom). Ended refreshes last frame.
      if (open.currentTime > dur - 0.35) captureHandoff(false)
    }
    const onTime = () => armHandoffEarly()
    open.addEventListener('timeupdate', onTime)
    const onEnded = () => {
      if (stillsStarted.current) return
      open.removeEventListener('timeupdate', onTime)
      captureHandoff(true, true)
      // Seamless even if capture failed (cream fallback underlay / CSS #efe6d8).
      goRead({ seamless: true })
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

  // Prefer open-zoom video; parchment alone only after open fail or prefer-wait.
  const canContinue =
    openReady || ((openFailed || allowStillsContinue) && stillsReady)
  const homesHidden = openVisible || stillsActive
  const plan = guidePlanId ? getPlan(guidePlanId) : undefined
  const planDay = plan ? Math.min(Math.max(guideDay, 0), plan.days.length - 1) : 0
  const planDone = plan ? (guideDone[plan.id] ?? []).length : 0
  const planToday = plan?.days[planDay] ?? []
  // An active plan with days left: the main button opens today's reading, Continue becomes the second choice.
  const planFinished = !!plan && planDone >= plan.days.length
  const planFirst = plan && !planFinished ? planToday[0] : undefined
  const openTo = (target: { book: string; chapter: number } | null) => {
    if (opening || openStarted.current) return
    openTarget.current = target
    startOpen()
  }

  const stillSrc =
    stillFrame && stillUrls
      ? stillUrls[stillFrame]
      : stillFrame
        ? OPEN_STILLS_PATHS[stillFrame]
        : null

  return (
    <div
      className={`chamber-root${idleDim ? ' is-idle' : ''}`}
      onClick={opening ? skipRitual : undefined}
    >
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
          className="chamber-open-still is-on"
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

      {opening && !veil && (
        <div className="chamber-skip" onClick={(e) => e.stopPropagation()}>
          <span className="chamber-skip-hint" role="status">
            {openVisible || stillsActive ? 'Opening the book…' : 'Loading the opening…'}
          </span>
          <button type="button" className="chamber-ghost" onClick={skipRitual} autoFocus>
            Skip
          </button>
        </div>
      )}

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
            {planFirst ? (
              <>
                <button
                  type="button"
                  className="chamber-ghost chamber-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    openTo(planFirst)
                  }}
                >
                  Today's reading: {formatDayReading(planToday)}
                </button>
                <button
                  type="button"
                  className="chamber-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    openTo(null)
                  }}
                >
                  {ctaLabel}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="chamber-ghost chamber-primary"
                onClick={(e) => {
                  e.stopPropagation()
                  openTo(null)
                }}
              >
                {ctaLabel}
              </button>
            )}
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
          {!canContinue && !opening && (
            <p className="chamber-loading-hint" role="status">
              The opening film is still loading. Tap Continue to go straight to the page.
            </p>
          )}

          {streak > 0 && (
            <p className="chamber-streak">
              Reading streak: {streak} day{streak === 1 ? '' : 's'}
            </p>
          )}

          {plan && (
            <div className="chamber-plan" onClick={stopHud}>
              <p className="chamber-plan-label">Reading plan</p>
              <p className="chamber-plan-name">
                {plan.name}: {planFinished ? 'all days done' : `day ${planDay + 1} of ${plan.days.length}`}
                {planDone > 0 && !planFinished ? ` · ${planDone} done` : ''}
              </p>
            </div>
          )}

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
                    softLeave('/read')
                  }}
                >
                  All books
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
