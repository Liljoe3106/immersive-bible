/** Chamber bed: Kevin MacLeod "Heart of Nowhere" (CC BY 3.0). Volume 0.18, 6s cubic ease-in.
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
let duckFactor = 1

const TARGET = 0.18
const FADE_IN_MS = 6000
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
 * Start the bed. Only call this from a real user action (the Sound button or the
 * open-book tap). If the browser still refuses, the label falls back to "Tap for sound".
 */
export function startAmbient(fadeMs = FADE_IN_MS) {
  if (muted) {
    notify()
    return
  }
  ensurePair()
  const el = current()
  if (started && !el.paused) {
    needsGesture = false
    fadeElTo(el, effectiveTarget(), Math.min(fadeMs, 1200))
    notify()
    return
  }
  started = true
  el.play()
    .then(() => {
      needsGesture = false
      watchLoop()
      notify()
    })
    .catch(() => {
      started = false
      needsGesture = true
      cancelFade()
      notify()
    })
  fadeElTo(el, effectiveTarget(), fadeMs)
  notify()
}

/** Mute: fade out, then pause so nothing keeps playing in the background. */
export function setAmbientMuted(next: boolean) {
  // Re-applying the same state must not cancel a fade that is already running.
  if (next === muted) {
    notify()
    return
  }
  muted = next
  if (!a && !b) {
    notify()
    return
  }
  const el = current()
  if (next) {
    cancelFade()
    const from = clampVol(el.volume)
    const t0 = performance.now()
    const step = (now: number) => {
      if (!muted) return
      const t = Math.min(1, (now - t0) / MUTE_FADE_MS)
      el.volume = clampVol(from * (1 - t))
      if (t < 1) {
        fadeRaf = requestAnimationFrame(step)
        return
      }
      stopLoopWatch()
      for (const x of [a, b]) {
        try {
          x?.pause()
        } catch {
          /* */
        }
      }
      started = false
      notify()
    }
    fadeRaf = requestAnimationFrame(step)
    notify()
    return
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

/** Honest label for Sound controls. */
export function ambientSoundLabel(): 'Sound on' | 'Sound off' | 'Tap for sound' {
  const s = getAmbientState()
  if (s.muted) return 'Sound off'
  if (s.playing) return 'Sound on'
  return 'Tap for sound'
}
