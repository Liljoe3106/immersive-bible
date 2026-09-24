import { parseReference } from './parse-ref'
import { loadSearchIndex } from './load'
import { looksLikeCircumstance } from '../circumstance'
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

export async function runSearch(q: string): Promise<SearchResult[]> {
  const trimmed = q.trim()
  if (!trimmed) return []

  if (looksLikeCircumstance(trimmed)) {
    return [{ kind: 'circumstance', text: trimmed }]
  }

  const parsed = parseReference(trimmed)
  if (parsed) {
    const index = await loadSearchIndex()
    if (parsed.verse) {
      const hit = index.find(
        ([b, c, v]) =>
          b === parsed.book && c === parsed.chapter && v === parsed.verse,
      )
      return [
        {
          kind: 'ref',
          book: parsed.book,
          chapter: parsed.chapter,
          verse: parsed.verse,
          ref: formatRef(parsed.book, parsed.chapter, parsed.verse),
          text: hit?.[3],
        },
      ]
    }
    return [
      {
        kind: 'ref',
        book: parsed.book,
        chapter: parsed.chapter,
        ref: formatRef(parsed.book, parsed.chapter),
      },
    ]
  }

  const index = await loadSearchIndex()
  const needle = trimmed.toLowerCase()
  const hits: { hit: SearchHit; score: number }[] = []
  for (const hit of index) {
    const text = hit[3].toLowerCase()
    if (!text.includes(needle)) continue
    const score = text.startsWith(needle) ? 3 : text.includes(` ${needle}`) ? 2 : 1
    hits.push({ hit, score })
    if (hits.length > 400) break
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 80).map(({ hit, score }) => ({
    kind: 'word' as const,
    book: hit[0],
    chapter: hit[1],
    verse: hit[2],
    ref: formatRef(hit[0], hit[1], hit[2]),
    text: hit[3],
    score,
  }))
}
