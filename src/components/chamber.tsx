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
const OPEN_SRC = '/chamber/open.mp4?v=stills3'
const POSTER = '/chamber/poster.jpg?v=v3c1'
const OPEN_STILLS = {
  closed: '/chamber/open-stills/closed-best.jpg?v=stills3',
  half: '/chamber/open-stills/half-best.jpg?v=stills3',
  open: '/chamber/open-stills/open-best.jpg?v=stills3',
  parchment: '/chamber/open-stills/blank-parchment-best.jpg?v=stills3',
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
/** Hard-cut stills timings (match open-pull-stills-v2 recipe). */
const STILL_CLOSED_MS = 1400
const STILL_HALF_MS = 1000
const STILL_OPEN_MS = 3400
const STILL_PARCHMENT_MS = 3000
const STILL_FLASH_MS = 200
/** Dual-home B after idle if blob never arrives. */
const HOME_B_IDLE_MS = 8000

type StillFrame = 'closed' | 'half' | 'open' | 'parchment'

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
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

  // Prefetch open.mp4 as Blob ONLY — never assign network OPEN_SRC to <video>.
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const ac = new AbortController()

    const run = async () => {
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
        if (!cancelled) {
          /* allowHomeB armed by idle timer below */
        }
      }
    }
    void run()

    void Promise.all([
      preloadImage(OPEN_STILLS.closed),
      preloadImage(OPEN_STILLS.half),
      preloadImage(OPEN_STILLS.open),
      preloadImage(OPEN_STILLS.parchment),
    ]).then(() => {
      if (!cancelled) setStillsReady(true)
    })

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

  const flashThen = (next: StillFrame) => {
    setStillFlash(true)
    stillsTimers.current.push(
      window.setTimeout(() => {
        setStillFrame(next)
        setStillFlash(false)
      }, STILL_FLASH_MS),
    )
  }

  const runStillsRitual = () => {
    if (stillsStarted.current || navigated.current) return
    stillsStarted.current = true
    openPlayBegun.current = true // cancel video path racing in
    pauseBothHomes()
    setOpenVisible(false)
    setOpening(true)
    setStillsActive(true)
    setStillFrame('closed')
    setStillFlash(false)
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

    let t = STILL_CLOSED_MS
    schedule(t, () => flashThen('half'))
    t += STILL_HALF_MS + STILL_FLASH_MS
    schedule(t, () => flashThen('open'))
    t += STILL_OPEN_MS + STILL_FLASH_MS
    schedule(t, () => flashThen('parchment'))
    t += STILL_PARCHMENT_MS + STILL_FLASH_MS
    schedule(t, () => {
      setVeil(true)
      window.setTimeout(() => goRead(), VEIL_TRANSITION_MS + 40)
    })
  }

  const startOpen = () => {
    if (opening || openStarted.current) return
    // Unblocked by stills OR blob-ready open — do NOT require home.mp4.
    if (!openReady && !stillsReady && !prefersReducedMotion()) return
    openStarted.current = true
    openPlayBegun.current = false
    ritualShown.current = false
    stillsStarted.current = false
    setOpening(true)
    setMoreOpen(false)
    startAmbient()
    duckAmbient(0.18, 400)

    if (prefersReducedMotion()) {
      setVeil(true)
      window.setTimeout(() => goRead(), VEIL_TRANSITION_MS + 40)
      return
    }

    const open = openRef.current
    const blobReady =
      !!openBlobUrl && !!open && open.readyState >= 2

    // Prefer stills whenever blob is missing / not ready — no wait.
    if (!blobReady) {
      runStillsRitual()
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
      runStillsRitual()
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
  const fadingHomes = openVisible || stillsActive

  const stillSrc =
    stillFrame === 'closed'
      ? OPEN_STILLS.closed
      : stillFrame === 'half'
        ? OPEN_STILLS.half
        : stillFrame === 'open'
          ? OPEN_STILLS.open
          : stillFrame === 'parchment'
            ? OPEN_STILLS.parchment
            : null

  return (
    <div className={`chamber-root${idleDim ? ' is-idle' : ''}`}>
      <video
        ref={homeRef}
        className={`chamber-video chamber-video-home${homeFront === 0 ? ' is-front' : ''}${fadingHomes ? ' is-fading' : ''}`}
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
          className={`chamber-video chamber-video-home${homeFront === 1 ? ' is-front' : ''}${fadingHomes ? ' is-fading' : ''}`}
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
          className={`chamber-open-still is-on${stillFrame === 'open' ? ' is-zooming' : ''}`}
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
