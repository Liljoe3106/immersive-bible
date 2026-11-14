/** Pre-recorded Grok narration (see scripts/grok-narration.mjs). Pure helpers, no DOM. */
import manifest from './narration-audio.json'
import { asset } from './asset'

export type GrokTimings = { voice: string; d: number; v: number[] }

const RECORDED = new Set<string>(manifest.chapters)
const VER = String(manifest.voice ?? 'none')

export function hasGrokAudio(book: string, chapter: number): boolean {
  return RECORDED.has(`${book}-${chapter}`)
}

export function grokAudioUrl(book: string, chapter: number): string {
  return asset(`narration/grok/${book}-${chapter}.mp3?v=${VER}`)
}

export function grokTimingsUrl(book: string, chapter: number): string {
  return asset(`narration/grok/${book}-${chapter}.json?v=${VER}`)
}

export { verseAt } from './narration'
