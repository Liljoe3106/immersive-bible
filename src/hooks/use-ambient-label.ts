import { useEffect, useState } from 'react'
import { ambientSoundLabel, setAmbientMuted, startAmbient, subscribeAmbient } from '../lib/ambient'
import { useAppStore } from '../lib/store'

export type SoundLabel = 'Sound on' | 'Sound off' | 'Tap for sound'

/** Honest Sound control label + toggle wired to ambient + store. Never starts music by itself. */
export function useAmbientSound() {
  const audioMuted = useAppStore((s) => s.audioMuted)
  const setAudioMuted = useAppStore((s) => s.setAudioMuted)
  const [label, setLabel] = useState<SoundLabel>(() => ambientSoundLabel())

  useEffect(() => {
    // Sync the saved choice into the player once; never start playback here.
    setAmbientMuted(audioMuted)
    const sync = () => setLabel(ambientSoundLabel())
    sync()
    return subscribeAmbient(sync)
  }, [audioMuted])

  const toggle = () => {
    if (label === 'Sound on') {
      setAudioMuted(true)
      setAmbientMuted(true)
      return
    }
    setAudioMuted(false)
    setAmbientMuted(false)
    startAmbient(2500)
  }

  return { label, toggle, audioMuted, active: label === 'Sound on' }
}
