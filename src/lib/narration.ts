/** Read-aloud helpers (pure, no DOM): voice choice and verse chunking for the browser's speechSynthesis. */

export type VoiceLike = { name: string; lang: string; localService?: boolean; default?: boolean }

/** Slowish, calm delivery. */
export const NARRATION_RATE = 0.86
export const NARRATION_PITCH = 0.95
/** Pause between verses, in ms. */
export const VERSE_GAP_MS = 380
/** How far the ambient bed dips while narrating (1 = no dip). */
export const NARRATION_DUCK = 0.5

const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i
const NATURAL = /(natural|neural|premium|enhanced|wavenet|studio|siri)/i
const GOOD_NAMES = /\b(google uk english|daniel|serena|kate|oliver|arthur|martha|libby|sonia|ryan|moira|karen|samantha|aria|jenny|guy|google us english|tessa|fiona)\b/i

/** Higher is better; -Infinity means never use it. */
export function scoreVoice(v: VoiceLike): number {
  const lang = (v.lang || '').replace('_', '-').toLowerCase()
  if (!lang.startsWith('en')) return -Infinity
  if (NOVELTY.test(v.name)) return -Infinity
  let s = 0
  if (lang === 'en-gb') s += 30
  else if (lang === 'en-us') s += 20
  else if (/^en-(ie|au|nz|ca|za)/.test(lang)) s += 15
  else s += 10
  if (NATURAL.test(v.name)) s += 40
  if (GOOD_NAMES.test(v.name)) s += 15
  if (/\bmale\b/i.test(v.name) && !/female/i.test(v.name)) s += 2
  if (v.localService) s += 3 // works offline, no cut-offs on long verses
  if (v.default) s += 1
  return s
}

/** Best English voice available on this device, or null (then the browser default English voice is used). */
export function pickVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null
  let bestScore = -Infinity
  for (const v of voices) {
    const sc = scoreVoice(v)
    if (sc > bestScore) {
      best = v
      bestScore = sc
    }
  }
  return bestScore === -Infinity ? null : best
}

/** Split a long verse into sentence-sized pieces (some engines stop speaking after ~15 s of one utterance). */
export function chunkVerse(text: string, max = 220): string[] {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return []
  if (t.length <= max) return [t]
  const parts = t.match(/[^.;:?!]+[.;:?!]+["')\]]*\s*|[^.;:?!]+$/g) ?? [t]
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    if (cur && (cur + p).length > max) {
      out.push(cur.trim())
      cur = ''
    }
    if (p.length > max) {
      // A very long clause: split at commas.
      for (const q of p.match(/[^,]+,?\s*/g) ?? [p]) {
        if (cur && (cur + q).length > max) {
          out.push(cur.trim())
          cur = ''
        }
        cur += q
      }
    } else cur += p
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
