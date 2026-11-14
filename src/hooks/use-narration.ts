import { useCallback, useEffect, useRef, useState } from 'react'
import { loadChapter } from '../lib/bible/load'
import { setNarrationDuck } from '../lib/ambient'
import {
  NARRATION_DUCK,
  NARRATION_PITCH,
  NARRATION_RATE,
  VERSE_GAP_MS,
  chunkVerse,
  pickVoice,
} from '../lib/narration'

export type NarrationState = 'idle' | 'playing' | 'paused'

export function speechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  )
}

/**
 * Read aloud the current chapter, verse by verse, with the browser's own voices (no external service).
 * Pause cancels and remembers the verse (pause/resume is unreliable on mobile engines).
 * Stops on chapter change, on leaving the reader, and when the page is hidden for good.
 */
export function useNarration(book: string, chapter: number) {
  const [supported] = useState(speechSupported)
  const [state, setState] = useState<NarrationState>('idle')
  const [verse, setVerse] = useState<number | undefined>(undefined)
  const verses = useRef<string[] | null>(null)
  const idx = useRef(0)
  const run = useRef(0)
  const gapTimer = useRef(0)
  const voice = useRef<SpeechSynthesisVoice | null>(null)
  const keep = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const choose = () => {
      voice.current = pickVoice(synth.getVoices())
    }
    choose()
    synth.addEventListener?.('voiceschanged', choose)
    return () => synth.removeEventListener?.('voiceschanged', choose)
  }, [supported])

  const halt = useCallback(() => {
    run.current++
    window.clearTimeout(gapTimer.current)
    if (supported) window.speechSynthesis.cancel()
    keep.current = null
  }, [supported])

  const stop = useCallback(() => {
    halt()
    verses.current = null
    idx.current = 0
    setState('idle')
    setVerse(undefined)
    setNarrationDuck(1, 900)
  }, [halt])

  const speakFrom = useCallback(
    (i: number) => {
      const list = verses.current
      if (!list) return
      halt()
      const my = run.current
      if (i >= list.length) {
        stop()
        return
      }
      idx.current = i
      setVerse(i + 1)
      setState('playing')
      setNarrationDuck(NARRATION_DUCK, 700)
      const pieces = chunkVerse(list[i])
      const say = (k: number) => {
        if (run.current !== my) return
        if (k >= pieces.length) {
          gapTimer.current = window.setTimeout(() => {
            if (run.current === my) speakFrom(i + 1)
          }, VERSE_GAP_MS)
          return
        }
        const u = new SpeechSynthesisUtterance(pieces[k])
        if (voice.current) {
          u.voice = voice.current
          u.lang = voice.current.lang
        } else u.lang = 'en-GB'
        u.rate = NARRATION_RATE
        u.pitch = NARRATION_PITCH
        u.volume = 1
        u.onend = () => say(k + 1)
        u.onerror = (e) => {
          if (run.current !== my) return
          if (e.error === 'interrupted' || e.error === 'canceled') return
          stop()
        }
        keep.current = u // keep a reference: some engines drop events for garbage-collected utterances
        window.speechSynthesis.speak(u)
      }
      say(0)
    },
    [halt, stop],
  )

  const play = useCallback(
    async (fromVerse?: number) => {
      if (!supported) return
      if (!verses.current) {
        const my = ++run.current
        try {
          const { en } = await loadChapter(book, chapter)
          if (run.current !== my) return
          verses.current = en
        } catch {
          return
        }
      }
      const start = fromVerse != null && fromVerse >= 1 ? fromVerse - 1 : idx.current
      speakFrom(Math.min(start, verses.current.length - 1))
    },
    [book, chapter, speakFrom, supported],
  )

  const pause = useCallback(() => {
    halt()
    setState('paused')
    setNarrationDuck(1, 900)
  }, [halt])

  const toggle = useCallback(
    (fromVerse?: number) => {
      if (state === 'playing') pause()
      else void play(state === 'idle' ? fromVerse : undefined)
    },
    [state, pause, play],
  )

  // New chapter (or book): stop cleanly. Leaving the reader: stop on unmount.
  useEffect(() => {
    return () => stop()
  }, [book, chapter, stop])

  useEffect(() => {
    const onHide = () => stop()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [stop])

  return { supported, state, verse, toggle, stop }
}
