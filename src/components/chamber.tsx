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
const OPEN_SRC = '/chamber/open.mp4?v=stills2'
const POSTER = '/chamber/poster.jpg?v=v3c1'
/** Start the back home clip this far before the front ends. */
const HOME_XFADE_LEAD_S = 1.65
/** Match .chamber-video-home opacity transition. */
const HOME_XFADE_MS = 1600
/** open.mp4 ~8.5s + buffer; veil starts ~0.9s before end */
const FAILSAFE_MS = 11000
const VEIL_LEAD_S = 0.9
/** Match .chamber-veil transition (850ms) + small settle so nav is fully opaque. */
const NAV_AFTER_VEIL_MS = 900
const VEIL_TRANSITION_MS = 850

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
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
  const [mediaReady, setMediaReady] = useState(false)
  const [idleDim, setIdleDim] = useState(false)
  const [homeFront, setHomeFront] = useState(0)
  const [reducedMotion] = useState(() => prefersReducedMotion())
  const navigated = useRef(false)
  const openStarted = useRef(false)
  const openPlayBegun = useRef(false)

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

  useEffect(() => {
    touchDay()
    setAmbientMuted(audioMuted)
    startAmbient()
    bindAmbientGesture()
  }, [audioMuted, touchDay])

  // Soft resume: restore home timeline if we left mid-session recently.
  useEffect(() => {
    const v = visibleHome() ?? homeRef.current
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
    }

    // Preload open clip quietly.
    const o = openRef.current
    if (o) {
      o.preload = 'auto'
      o.load()
      const onOpenReady = () => {
        /* keep ready for hand-off */
      }
      o.addEventListener('canplaythrough', onOpenReady)
    }

    return () => {
      v.removeEventListener('play', tryAmbient)
      v.removeEventListener('playing', tryAmbient)
      v.removeEventListener('canplay', onReady)
      v.removeEventListener('loadeddata', onReady)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once on mount
  }, [])

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
    if (reducedMotion) return
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
  }, [reducedMotion])

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

  const startOpen = () => {
    if (opening || openStarted.current) return
    if (!mediaReady && !prefersReducedMotion()) {
      // Still allow open; readiness gate dims CTA but click can proceed once ready.
      if (homeRef.current && homeRef.current.readyState < 2) return
    }
    openStarted.current = true
    openPlayBegun.current = false
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
    if (!open) {
      goRead()
      return
    }

    const beginOpenPlayback = () => {
      if (openPlayBegun.current) return
      openPlayBegun.current = true
      open.loop = false
      open.currentTime = 0
      const playP = open.play()
      const show = () => setOpenVisible(true)
      if (playP && typeof playP.then === 'function') {
        playP.then(show).catch(() => goRead())
      } else {
        show()
      }
      window.setTimeout(() => {
        pauseBothHomes()
      }, 320)
    }

    if (open.readyState >= 2) beginOpenPlayback()
    else {
      open.addEventListener('canplay', beginOpenPlayback, { once: true })
      open.load()
      // If preload stalls, fall through to failsafe nav via ended/timeout.
      window.setTimeout(() => {
        if (!openPlayBegun.current && open.readyState >= 2) beginOpenPlayback()
      }, 1200)
    }

    let veilArmed = false
    const armVeilEarly = () => {
      if (veilArmed || navigated.current) return
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
      open.removeEventListener('timeupdate', onTime)
      goRead()
    }
    open.addEventListener('ended', onEnded, { once: true })
    window.setTimeout(() => {
      open.removeEventListener('timeupdate', onTime)
      goRead()
    }, FAILSAFE_MS)
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

  return (
    <div className={`chamber-root${idleDim ? ' is-idle' : ''}`}>
      <video
        ref={homeRef}
        className={`chamber-video chamber-video-home${homeFront === 0 ? ' is-front' : ''}${openVisible ? ' is-fading' : ''}`}
        src={HOME_SRC}
        poster={POSTER}
        autoPlay
        muted
        playsInline
        loop={reducedMotion}
        preload="auto"
        onClick={startOpen}
      />
      {!reducedMotion && (
        <video
          ref={homeBRef}
          className={`chamber-video chamber-video-home${homeFront === 1 ? ' is-front' : ''}${openVisible ? ' is-fading' : ''}`}
          src={HOME_SRC}
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
      )}
      <video
        ref={openRef}
        className={`chamber-video chamber-video-open${openVisible ? ' is-on' : ''}`}
        src={OPEN_SRC}
        muted
        playsInline
        preload="auto"
        aria-hidden
      />
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
        disabled={opening}
      />

      <div className={`chamber-dock${opening ? ' is-opening' : ''}`} aria-hidden={opening}>
        <div className="chamber-row" style={{ justifyContent: 'space-between' }} onClick={stopHud}>
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
              disabled={!mediaReady && !opening}
              aria-disabled={!mediaReady && !opening}
              onClick={(e) => {
                e.stopPropagation()
                startOpen()
              }}
            >
              {mediaReady ? ctaLabel : 'Preparing…'}
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
