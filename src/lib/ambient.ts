/** Chamber bed: Kevin MacLeod "Heart of Nowhere" (CC BY 3.0). Volume 0.18, 24s cubic ease-in.
 * Tempo slowed ~20% via atempo=0.8 (pitch preserved). Dual-element loop crossfade. */

import { asset } from './asset'

type AmbientListener = () => void

let a: HTMLAudioElement | null = null
let b: HTMLAudioElement | null = null
let active: 'a' | 'b' = 'a'
let started = false
let muted = false
let needsGesture = false
let fadeRaf = 0
let loopRaf = 0
let unlockBound = false
let duckFactor = 1

const TARGET = 0.18
const FADE_IN_MS = 24000
const MUTE_FADE_MS = 600
const LOOP_CROSS_S = 1.4
const DUCK_MS = 280
const SRC = asset('chamber/bed.mp3?v=hon2')

const listeners = new Set<AmbientListener>()

function clampVol(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

function notify() {
  for (const cb of listeners) {
    try {
      cb()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeAmbient(cb: AmbientListener) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Snapshot for honest Sound labels. */
export function getAmbientState() {
  const el = current()
  const playing = !!(el && !el.paused && started)
  const audible = playing && !muted && clampVol(el!.volume) > 0.001
  return { muted, started, needsGesture, playing, audible }
}

function cubicEaseIn(t: number) {
  return t * t * t
}

function makeEl() {
  const el = new Audio(SRC)
  el.loop = false
  el.preload = 'auto'
  el.volume = 0
  return el
}

function ensurePair() {
  if (!a) a = makeEl()
  if (!b) b = makeEl()
  return { a, b }
}

function current() {
  ensurePair()
  return active === 'a' ? a! : b!
}

function other() {
  ensurePair()
  return active === 'a' ? b! : a!
}

function effectiveTarget() {
  return muted ? 0 : TARGET * duckFactor
}

function cancelFade() {
  cancelAnimationFrame(fadeRaf)
  fadeRaf = 0
}

function fadeElTo(el: HTMLAudioElement, target: number, ms: number) {
  cancelFade()
  const from = clampVol(el.volume)
  const to = clampVol(target)
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / Math.max(1, ms))
    const e = to > from ? cubicEaseIn(t) : t
    el.volume = clampVol(from + (to - from) * e)
    if (t < 1) fadeRaf = requestAnimationFrame(step)
    else notify()
  }
  fadeRaf = requestAnimationFrame(step)
}

function clearUnlockListeners() {
  if (!unlockBound) return
  unlockBound = false
  window.removeEventListener('pointerdown', unlockOnce)
  window.removeEventListener('touchstart', unlockOnce)
  window.removeEventListener('keydown', unlockOnce)
  document.removeEventListener('visibilitychange', onVisibilityUnlock)
  window.removeEventListener('pageshow', onPageshowUnlock)
}

function unlockOnce() {
  startAmbient()
  if (started) clearUnlockListeners()
}

function onVisibilityUnlock() {
  if (document.visibilityState === 'visible') startAmbient()
}

function onPageshowUnlock() {
  startAmbient()
}

function bindUnlockFallbacks() {
  if (unlockBound) return
  unlockBound = true
  needsGesture = true
  notify()
  window.addEventListener('pointerdown', unlockOnce)
  window.addEventListener('touchstart', unlockOnce, { passive: true })
  window.addEventListener('keydown', unlockOnce)
  document.addEventListener('visibilitychange', onVisibilityUnlock)
  window.addEventListener('pageshow', onPageshowUnlock)
}

function stopLoopWatch() {
  cancelAnimationFrame(loopRaf)
  loopRaf = 0
}

function watchLoop() {
  stopLoopWatch()
  const tick = () => {
    const cur = current()
    const dur = cur.duration
    if (Number.isFinite(dur) && dur > 0 && !cur.paused) {
      const left = dur - cur.currentTime
      if (left <= LOOP_CROSS_S && left > 0) {
        void crossfadeLoop()
        return
      }
    }
    loopRaf = requestAnimationFrame(tick)
  }
  loopRaf = requestAnimationFrame(tick)
}

async function crossfadeLoop() {
  const cur = current()
  const nxt = other()
  try {
    nxt.currentTime = 0
    nxt.volume = 0
    await nxt.play()
  } catch {
    // Fall back to simple restart on current
    try {
      cur.currentTime = 0
    } catch {
      /* */
    }
    watchLoop()
    return
  }
  const t0 = performance.now()
  const ms = Math.max(200, LOOP_CROSS_S * 1000 * 0.85)
  const fromVol = clampVol(cur.volume)
  const target = effectiveTarget()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms)
    cur.volume = clampVol(fromVol * (1 - t))
    nxt.volume = clampVol(target * t)
    if (t < 1) {
      fadeRaf = requestAnimationFrame(step)
    } else {
      cur.pause()
      try {
        cur.currentTime = 0
      } catch {
        /* */
      }
      cur.volume = 0
      active = active === 'a' ? 'b' : 'a'
      watchLoop()
      notify()
    }
  }
  cancelFade()
  fadeRaf = requestAnimationFrame(step)
}

/**
 * Best-effort ambient start. Browsers may reject unmuted autoplay until a
 * user gesture; on rejection we bind unlock fallbacks. When muted, plays at 0
 * so later unmute can fade without a new gesture when the UA allows it.
 */
export function startAmbient() {
  ensurePair()
  const el = current()
  if (started && !el.paused) {
    needsGesture = false
    notify()
    return
  }
  started = true
  if (muted) {
    cancelFade()
    el.volume = 0
    el.play()
      .then(() => {
        needsGesture = false
        clearUnlockListeners()
        watchLoop()
        notify()
      })
      .catch(() => {
        started = false
        bindUnlockFallbacks()
        notify()
      })
    return
  }
  el.play()
    .then(() => {
      needsGesture = false
      clearUnlockListeners()
      watchLoop()
      notify()
    })
    .catch(() => {
      started = false
      cancelFade()
      bindUnlockFallbacks()
      notify()
    })
  fadeElTo(el, effectiveTarget(), FADE_IN_MS)
  notify()
}

export function setAmbientMuted(next: boolean) {
  muted = next
  const el = current()
  cancelFade()
  if (next) {
    // Prefer volume fade over pause so unmute is not stranded behind autoplay.
    fadeElTo(el, 0, MUTE_FADE_MS)
    notify()
    return
  }
  if (!started) {
    notify()
    return
  }
  const alreadyPlaying = !el.paused
  el.play()
    .then(() => {
      needsGesture = false
      clearUnlockListeners()
      watchLoop()
      notify()
    })
    .catch(() => {
      started = false
      bindUnlockFallbacks()
      notify()
    })
  if (alreadyPlaying && clampVol(el.volume) >= TARGET * 0.95 * duckFactor) {
    el.volume = clampVol(effectiveTarget())
  } else {
    fadeElTo(el, effectiveTarget(), MUTE_FADE_MS)
  }
  notify()
}

/** Temporarily lower bed under open film / page-turn SFX. */
export function duckAmbient(factor = 0.22, ms = DUCK_MS) {
  duckFactor = Math.min(1, Math.max(0, factor))
  const el = current()
  if (!started || muted) return
  fadeElTo(el, effectiveTarget(), ms)
}

export function unduckAmbient(ms = 900) {
  duckFactor = 1
  const el = current()
  if (!started || muted) return
  fadeElTo(el, effectiveTarget(), ms)
}

export function isAmbientMuted() {
  return muted
}

/** Gesture/visibility unlock fallback when autoplay was blocked. */
export function bindAmbientGesture() {
  bindUnlockFallbacks()
}

/** Honest label for Sound controls. */
export function ambientSoundLabel(): 'Sound on' | 'Sound off' | 'Tap for sound' {
  const s = getAmbientState()
  if (s.muted) return 'Sound off'
  // Playing (even mid fade-in) counts as on; blocked autoplay stays Tap for sound.
  if (s.needsGesture || !s.playing) return 'Tap for sound'
  return 'Sound on'
}
