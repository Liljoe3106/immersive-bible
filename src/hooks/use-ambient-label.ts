import { useEffect, useState } from 'react'
import {
  ambientSoundLabel,
  bindAmbientGesture,
  getAmbientState,
  setAmbientMuted,
  startAmbient,
  subscribeAmbient,
} from '../lib/ambient'
import { useAppStore } from '../lib/store'

export type SoundLabel = 'Sound on' | 'Sound off' | 'Tap for sound'

/** Honest Sound control label + toggle wired to ambient + store. */
export function useAmbientSound() {
  const audioMuted = useAppStore((s) => s.audioMuted)
  const setAudioMuted = useAppStore((s) => s.setAudioMuted)
  const [label, setLabel] = useState<SoundLabel>(() => ambientSoundLabel())

  useEffect(() => {
    setAmbientMuted(audioMuted)
    const sync = () => setLabel(ambientSoundLabel())
    sync()
    return subscribeAmbient(sync)
  }, [audioMuted])

  const toggle = () => {
    startAmbient()
    bindAmbientGesture()
    const state = getAmbientState()
    if (audioMuted) {
      setAudioMuted(false)
      setAmbientMuted(false)
      startAmbient()
      return
    }
    if (state.needsGesture || !state.audible) {
      setAudioMuted(false)
      setAmbientMuted(false)
      startAmbient()
      return
    }
    setAudioMuted(true)
    setAmbientMuted(true)
  }

  return { label, toggle, audioMuted, active: label === 'Sound on' }
}
