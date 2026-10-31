import { parseReference } from './parse-ref'
import { loadSearchIndex } from './load'
import { editDistance, looksLikeCircumstance } from '../circumstance'
import type { SearchHit } from './types'
import { formatRef } from './books'

export type SearchKind = 'ref' | 'word' | 'circumstance'

export interface SearchResult {
  kind: SearchKind
  ref?: string
  book?: string
  chapter?: number
  verse?: number
  text?: string
  score?: number
}

export interface SearchOutcome {
  results: SearchResult[]
  /** Every matching verse, not just the ones shown. */
  total: number
  /** Set when the words were spelled differently from the Bible and we searched a close match instead. */
  correctedTo?: string
}

const SHOW = 80

let vocab: Map<string, number> | null = null
function vocabulary(index: SearchHit[]) {
  if (vocab) return vocab
  vocab = new Map()
  for (const hit of index) {
    for (const w of hit[3].toLowerCase().split(/[^a-z']+/)) {
      if (w.length < 3) continue
      vocab.set(w, (vocab.get(w) ?? 0) + 1)
    }
  }
  return vocab
}

/** Closest real word in the text, for typos like "mercey" or "shepard". */
function closestWord(word: string, index: SearchHit[]): string | null {
  const v = vocabulary(index)
  if (v.has(word)) return word
  const limit = word.length >= 6 ? 2 : 1
  let best: { w: string; d: number; n: number } | null = null
  for (const [w, n] of v) {
    if (Math.abs(w.length - word.length) > limit) continue
    const d = editDistance(word, w)
    if (d > limit) continue
    if (!best || d < best.d || (d === best.d && n > best.n)) best = { w, d, n }
  }
  return best?.w ?? null
}

function wordSearch(index: SearchHit[], needle: string) {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const whole = new RegExp(`(^|[^a-z])${esc}($|[^a-z])`, 'i')
  const hits: { hit: SearchHit; score: number; i: number }[] = []
  index.forEach((hit, i) => {
    const text = hit[3].toLowerCase()
    if (!text.includes(needle)) return
    const score = whole.test(text) ? (text.startsWith(needle) ? 4 : 3) : 1
    hits.push({ hit, score, i })
  })
  hits.sort((a, b) => b.score - a.score || a.i - b.i)
  return hits
}

export async function runSearch(q: string): Promise<SearchOutcome> {
  const trimmed = q.trim()
  if (!trimmed) return { results: [], total: 0 }

  if (looksLikeCircumstance(trimmed)) {
    return { results: [{ kind: 'circumstance', text: trimmed }], total: 1 }
  }

  const parsed = parseReference(trimmed)
  if (parsed) {
    const index = await loadSearchIndex()
    if (parsed.verse) {
      const hit = index.find(([b, c, v]) => b === parsed.book && c === parsed.chapter && v === parsed.verse)
      return {
        total: 1,
        results: [
          {
            kind: 'ref',
            book: parsed.book,
            chapter: parsed.chapter,
            verse: parsed.verse,
            ref: formatRef(parsed.book, parsed.chapter, parsed.verse),
            text: hit?.[3],
          },
        ],
      }
    }
    return {
      total: 1,
      results: [
        { kind: 'ref', book: parsed.book, chapter: parsed.chapter, ref: formatRef(parsed.book, parsed.chapter) },
      ],
    }
  }

  const index = await loadSearchIndex()
  const needle = trimmed.toLowerCase().replace(/\s+/g, ' ')
  let hits = wordSearch(index, needle)
  let correctedTo: string | undefined
  if (hits.length === 0) {
    const words = needle.split(' ')
    const fixed = words.map((w) => (w.length >= 3 ? closestWord(w, index) ?? w : w))
    const alt = fixed.join(' ')
    if (alt !== needle) {
      const altHits = wordSearch(index, alt)
      if (altHits.length) {
        hits = altHits
        correctedTo = alt
      }
    }
  }
  return {
    total: hits.length,
    correctedTo,
    results: hits.slice(0, SHOW).map(({ hit, score }) => ({
      kind: 'word' as const,
      book: hit[0],
      chapter: hit[1],
      verse: hit[2],
      ref: formatRef(hit[0], hit[1], hit[2]),
      text: hit[3],
      score,
    })),
  }
}
