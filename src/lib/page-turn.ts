/** Soft page-turn SFX. Source: BigSoundBank "Pages that turn #6" (Joseph Sardin), CC0. */

import { duckAmbient, unduckAmbient } from './ambient'
import { asset } from './asset'
import { useAppStore } from './store'

let shared: HTMLAudioElement | null = null

function ensure() {
  if (shared) return shared
  shared = new Audio(asset('chamber/page-turn.mp3'))
  shared.preload = 'auto'
  shared.volume = 0.35
  return shared
}

/** Play a soft page-turn; no-op when Sound is off (`audioMuted`). Ducks bed briefly. */
export function playPageTurn() {
  if (useAppStore.getState().audioMuted) return
  const a = ensure()
  try {
    duckAmbient(0.28, 120)
    a.pause()
    a.currentTime = 0
    a.volume = 0.35
    void a.play().catch(() => {})
    window.setTimeout(() => unduckAmbient(700), 420)
  } catch {
    /* autoplay / missing file */
  }
}
