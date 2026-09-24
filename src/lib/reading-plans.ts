import { BOOKS, BOOK_BY_ID, formatRef } from './bible/books'

export interface ReadingRef {
  book: string
  chapter: number
}

export interface ReadingPlan {
  id: string
  name: string
  blurb: string
  days: ReadingRef[][]
}

function chaptersOf(bookIds: string[]): ReadingRef[] {
  const out: ReadingRef[] = []
  for (const id of bookIds) {
    const b = BOOK_BY_ID[id]
    if (!b) continue
    for (let c = 1; c <= b.chapters; c++) out.push({ book: id, chapter: c })
  }
  return out
}

/** Split a flat chapter list into fixed-size day chunks (last day may be shorter). */
function chunkBySize(readings: ReadingRef[], perDay: number): ReadingRef[][] {
  const days: ReadingRef[][] = []
  for (let i = 0; i < readings.length; i += perDay) {
    days.push(readings.slice(i, i + perDay))
  }
  return days
}

/** Spread readings across exactly targetDays, as evenly as possible. */
function chunkIntoDays(readings: ReadingRef[], targetDays: number): ReadingRef[][] {
  const n = readings.length
  if (n === 0 || targetDays <= 0) return []
  const days = Math.min(targetDays, n)
  const base = Math.floor(n / days)
  const rem = n % days
  const out: ReadingRef[][] = []
  let i = 0
  for (let d = 0; d < days; d++) {
    const size = base + (d < rem ? 1 : 0)
    out.push(readings.slice(i, i + size))
    i += size
  }
  return out
}

const NT_IDS = BOOKS.filter((b) => b.testament === 'nt').map((b) => b.id)
const ALL_IDS = BOOKS.map((b) => b.id)

const STORY_IDS = [
  'gen',
  'exo',
  'jos',
  'jdg',
  '1sa',
  '2sa',
  '1ki',
  '2ki',
  'ezr',
  'neh',
  'luk',
  'act',
]

export const READING_PLANS: ReadingPlan[] = [
  {
    id: 'begin-here',
    name: 'Begin here',
    blurb: 'Gospel of John, then Mark, then Philippians. One chapter a day.',
    days: chunkBySize(chaptersOf(['jhn', 'mrk', 'php']), 1),
  },
  {
    id: 'gospels',
    name: 'The Gospels',
    blurb: 'Matthew through John in order. One chapter a day.',
    days: chunkBySize(chaptersOf(['mat', 'mrk', 'luk', 'jhn']), 1),
  },
  {
    id: 'nt-90',
    name: 'New Testament in 90 days',
    blurb: 'All New Testament books in Protestant order, paced across about 90 days.',
    days: chunkIntoDays(chaptersOf(NT_IDS), 90),
  },
  {
    id: 'psalms-month',
    name: 'Psalms in a month',
    blurb: 'All 150 psalms over 30 days (about five a day).',
    days: chunkBySize(chaptersOf(['psa']), 5),
  },
  {
    id: 'proverbs',
    name: 'Proverbs',
    blurb: 'One chapter a day for 31 days.',
    days: chunkBySize(chaptersOf(['pro']), 1),
  },
  {
    id: 'straight-through',
    name: 'Straight through',
    blurb: 'Genesis to Revelation at about three chapters a day.',
    days: chunkBySize(chaptersOf(ALL_IDS), 3),
  },
  {
    id: 'story',
    name: 'Story',
    blurb:
      'A narrative path: Genesis, Exodus, Joshua, Judges, Samuel, Kings, Ezra, Nehemiah, Luke, Acts. One chapter a day.',
    days: chunkBySize(chaptersOf(STORY_IDS), 1),
  },
]

export const PLAN_BY_ID = Object.fromEntries(
  READING_PLANS.map((p) => [p.id, p]),
) as Record<string, ReadingPlan>

export function getPlan(id: string): ReadingPlan | undefined {
  return PLAN_BY_ID[id]
}

export function formatDayReading(refs: ReadingRef[]): string {
  return refs.map((r) => formatRef(r.book, r.chapter)).join(', ')
}
