import type { EnglishChapter, OrigChapter, OrigWord, SearchHit, StrongEntry } from './types'

const enCache = new Map<string, EnglishChapter[]>()
const origCache = new Map<string, OrigChapter[]>()
let strongsCache: Record<string, StrongEntry> | null = null
let searchCache: SearchHit[] | null = null

export async function loadEnglish(book: string): Promise<EnglishChapter[]> {
  const hit = enCache.get(book)
  if (hit) return hit
  const res = await fetch(`/data/en/${book}.json`)
  if (!res.ok) throw new Error(`Missing English for ${book}`)
  const data = (await res.json()) as EnglishChapter[]
  enCache.set(book, data)
  return data
}

export async function loadOrig(book: string): Promise<OrigChapter[] | null> {
  if (origCache.has(book)) return origCache.get(book)!
  const res = await fetch(`/data/orig/${book}.json`)
  if (!res.ok) {
    origCache.set(book, null as unknown as OrigChapter[])
    return null
  }
  const data = (await res.json()) as OrigChapter[]
  origCache.set(book, data)
  return data
}

export async function loadChapter(
  book: string,
  chapter: number,
): Promise<{ en: string[]; orig: OrigWord[][] | null }> {
  const [enAll, origAll] = await Promise.all([loadEnglish(book), loadOrig(book)])
  const en = enAll[chapter - 1] ?? []
  const orig = origAll ? (origAll[chapter - 1] ?? null) : null
  return { en, orig }
}

export async function loadStrongs(): Promise<Record<string, StrongEntry>> {
  if (strongsCache) return strongsCache
  const res = await fetch('/data/strongs.json')
  if (!res.ok) return {}
  strongsCache = (await res.json()) as Record<string, StrongEntry>
  return strongsCache
}

export async function loadSearchIndex(): Promise<SearchHit[]> {
  if (searchCache) return searchCache
  const res = await fetch('/data/search.json')
  if (!res.ok) return []
  searchCache = (await res.json()) as SearchHit[]
  return searchCache
}

export function getStrongSync(id: string): StrongEntry | undefined {
  return strongsCache?.[id.toUpperCase()]
}
