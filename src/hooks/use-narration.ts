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
import { type GrokTimings, grokAudioUrl, grokTimingsUrl, hasGrokAudio, verseAt } from '../lib/grok-audio'

export type NarrationState = 'idle' | 'playing' | 'paused'

export function speechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  )
}

/** iOS only lets speech start from a tap; one silent utterance inside the first tap unlocks it for the session. */
let speechWarmed = false

/**
 * Read aloud the current chapter.
 * - Chapters with a pre-recorded Grok narration play that MP3 (verse highlight from its timing file).
 * - Others use the browser's own voices, verse by verse.
 * Everything that makes sound starts synchronously inside the tap (iOS requires it): the chapter text and
 * the recording are prepared when the chapter opens, not when Listen is pressed.
 * Stops on chapter change, on leaving the reader, and when the page is hidden for good.
 */
export function useNarration(book: string, chapter: number) {
  const recorded = hasGrokAudio(book, chapter)
  const [speech] = useState(speechSupported)
  const supported = recorded || speech
  const [state, setState] = useState<NarrationState>('idle')
  const [verse, setVerse] = useState<number | undefined>(undefined)
  const [source, setSource] = useState<'grok' | 'speech' | null>(null)
  const verses = useRef<string[] | null>(null)
  const idx = useRef(0)
  const run = useRef(0)
  const gapTimer = useRef(0)
  const raf = useRef(0)
  const voice = useRef<SpeechSynthesisVoice | null>(null)
  const keep = useRef<SpeechSynthesisUtterance | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const timings = useRef<GrokTimings | null>(null)
  /** Grok recording failed to load: use the browser voice for this chapter. */
  const grokBroken = useRef(false)
  const mode = useRef<'grok' | 'speech' | null>(null)

  useEffect(() => {
    if (!speech) return
    const synth = window.speechSynthesis
    const choose = () => {
      voice.current = pickVoice(synth.getVoices())
    }
    choose()
    synth.addEventListener?.('voiceschanged', choose)
    return () => synth.removeEventListener?.('voiceschanged', choose)
  }, [speech])

  // Prepare the chapter as soon as it opens so the tap can start sound with no await.
  useEffect(() => {
    let live = true
    verses.current = null
    timings.current = null
    grokBroken.current = false
    loadChapter(book, chapter)
      .then(({ en }) => {
        if (live) verses.current = en
      })
      .catch(() => {})
    if (recorded) {
      fetch(grokTimingsUrl(book, chapter))
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((t: GrokTimings) => {
          if (live && Array.isArray(t.v)) timings.current = t
        })
        .catch(() => {
          if (live) grokBroken.current = true
        })
      const el = new Audio()
      el.preload = 'metadata'
      el.src = grokAudioUrl(book, chapter)
      audio.current = el
    }
    return () => {
      live = false
      const el = audio.current
      audio.current = null
      if (el) {
        el.pause()
        el.removeAttribute('src')
        el.load()
      }
    }
  }, [book, chapter, recorded])

  const halt = useCallback((cancelSpeech = true) => {
    run.current++
    window.clearTimeout(gapTimer.current)
    cancelAnimationFrame(raf.current)
    if (speech && cancelSpeech) {
      const synth = window.speechSynthesis
      // Cancelling an idle synth right before speak() can swallow the next utterance on iOS.
      if (synth.speaking || synth.pending) synth.cancel()
    }
    audio.current?.pause()
    keep.current = null
  }, [speech])

  const stop = useCallback(() => {
    halt()
    idx.current = 0
    mode.current = null
    if (audio.current) {
      try {
        audio.current.currentTime = 0
      } catch {
        /* not loaded yet */
      }
    }
    setState('idle')
    setVerse(undefined)
    setSource(null)
    setNarrationDuck(1, 900)
  }, [halt])

  /* ---------- browser voice ---------- */

  const speakFrom = useCallback(
    (i: number, afterWarmUp = false) => {
      const list = verses.current
      if (!list) return
      halt(!afterWarmUp) // never cancel the silent warm-up: queue behind it instead
      const my = run.current
      if (i >= list.length) {
        stop()
        return
      }
      mode.current = 'speech'
      setSource('speech')
      idx.current = i
      setVerse(i + 1)
      setState('playing')
      setNarrationDuck(NARRATION_DUCK, 700)
      const synth = window.speechSynthesis
      if (!voice.current) voice.current = pickVoice(synth.getVoices()) // voices can arrive late (iOS, Chrome)
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
        if (synth.paused) synth.resume()
        synth.speak(u)
      }
      say(0)
    },
    [halt, stop],
  )

  /** Must run synchronously inside the tap. */
  const warmSpeech = useCallback((): boolean => {
    if (!speech || speechWarmed) return false
    speechWarmed = true
    const synth = window.speechSynthesis
    if (synth.paused) synth.resume()
    const w = new SpeechSynthesisUtterance(' ')
    w.volume = 0
    w.rate = 1
    synth.speak(w)
    return true
  }, [speech])

  const speechFrom = useCallback(
    (start: number) => {
      if (!speech) return
      const warmed = warmSpeech()
      if (verses.current) {
        speakFrom(Math.min(start, verses.current.length - 1), warmed)
        return
      }
      // Text not ready yet (slow network): the warm-up already unlocked speech, so starting a moment later is fine.
      const my = ++run.current
      setState('playing')
      loadChapter(book, chapter)
        .then(({ en }) => {
          if (run.current !== my) return
          verses.current = en
          speakFrom(Math.min(start, en.length - 1), true)
        })
        .catch(() => {
          if (run.current === my) stop()
        })
    },
    [book, chapter, speakFrom, speech, stop, warmSpeech],
  )

  /* ---------- Grok recording ---------- */

  const grokFrom = useCallback(
    (startVerse: number | null) => {
      const el = audio.current
      if (!el) return false
      halt()
      const my = run.current
      mode.current = 'grok'
      setSource('grok')
      if (startVerse != null) {
        // 0 = from the top (with the chapter heading); n = the asked verse.
        const t = startVerse >= 1 ? timings.current?.v[startVerse - 1] : 0
        try {
          el.currentTime = t != null ? Math.max(0, t - 0.05) : 0
        } catch {
          /* metadata not loaded yet: starts from 0 */
        }
      }
      const fallback = () => {
        if (run.current !== my) return
        grokBroken.current = true
        el.pause()
        speechFrom(Math.max(0, (verseFromAudio() ?? 1) - 1))
      }
      const verseFromAudio = () => (timings.current ? verseAt(timings.current.v, el.currentTime) : undefined)
      el.onended = () => {
        if (run.current === my) stop()
      }
      el.onerror = fallback
      const p = el.play() // straight from the tap: no await before this line
      setState('playing')
      setNarrationDuck(NARRATION_DUCK, 700)
      p?.catch((e: unknown) => {
        if (run.current !== my) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (e instanceof DOMException && e.name === 'NotAllowedError') {
          stop()
          return
        }
        fallback()
      })
      const tick = () => {
        if (run.current !== my) return
        const v = verseFromAudio()
        if (v != null) setVerse((cur) => (cur === v ? cur : v))
        raf.current = requestAnimationFrame(tick)
      }
      setVerse(verseFromAudio() ?? (startVerse || 1))
      raf.current = requestAnimationFrame(tick)
      return true
    },
    [halt, speechFrom, stop],
  )

  /* ---------- controls (call from tap handlers) ---------- */

  const play = useCallback(
    (fromVerse?: number) => {
      const from = fromVerse != null && fromVerse >= 1 ? fromVerse : null
      const useGrok = recorded && !grokBroken.current && audio.current
      if (useGrok) {
        // Resume keeps the position; a fresh start goes to the asked verse or the top.
        const fresh = state === 'idle' || mode.current !== 'grok'
        if (grokFrom(fresh ? (from ?? 0) : null)) return
      }
      const start = from != null ? from - 1 : idx.current
      speechFrom(start)
    },
    [grokFrom, recorded, speechFrom, state],
  )

  const pause = useCallback(() => {
    if (mode.current === 'grok') {
      run.current++
      cancelAnimationFrame(raf.current)
      audio.current?.pause()
    } else halt()
    setState('paused')
    setNarrationDuck(1, 900)
  }, [halt])

  const toggle = useCallback(
    (fromVerse?: number) => {
      if (state === 'playing') pause()
      else play(state === 'idle' ? fromVerse : undefined)
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

  return { supported, recorded, source, state, verse, toggle, stop }
}
