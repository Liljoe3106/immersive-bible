import { BOOK_ALIASES, BOOK_BY_ID } from './books'

export interface ParsedRef {
  book: string
  chapter: number
  verse?: number
  endVerse?: number
}

const REF_RE =
  /^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+)(?:\s*[-–—]\s*(\d+))?)?$/

export function parseReference(q: string): ParsedRef | null {
  const cleaned = q.trim().replace(/\s+/g, ' ')
  const m = cleaned.match(REF_RE)
  if (!m) return null
  const bookRaw = m[1].toLowerCase().replace(/\s+/g, ' ')
  const compact = bookRaw.replace(/\s+/g, '')
  const id = BOOK_ALIASES[bookRaw] ?? BOOK_ALIASES[compact]
  if (!id || !BOOK_BY_ID[id]) return null
  const chapter = Number(m[2])
  const verse = m[3] ? Number(m[3]) : undefined
  const endVerse = m[4] ? Number(m[4]) : undefined
  const book = BOOK_BY_ID[id]
  if (chapter < 1 || chapter > book.chapters) return null
  return { book: id, chapter, verse, endVerse }
}
