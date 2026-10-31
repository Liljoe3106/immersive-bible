import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Place, ReadMode } from './bible/types'

export interface VerseMark {
  book: string
  chapter: number
  verse: number
  note?: string
  at: number
}

export interface StrongBookmark {
  strong: string
  at: number
}

interface AppState {
  place: Place
  recents: Place[]
  bookmarks: StrongBookmark[]
  verseMarks: VerseMark[]
  daysOpened: string[]
  streak: number
  namedQueries: Record<string, unknown>
  readSize: 0 | 1 | 2
  layoutMode: 'scroll' | 'book'
  readMode: ReadMode
  audioMuted: boolean
  /** Soft resume: home video should continue near last time when returning mid-session. */
  chamberResumeAt: number | null
  /** Session-only: arm settle-in zoom when leaving chamber open ritual for reader. */
  readerSettlePending: boolean
  /** Session-only: last open.mp4 frame data URL for seamless reader underlay. */
  openHandoffFrame: string | null
  guidePlanId: string | null
  guideDay: number
  /** Finished day indexes per plan id. */
  guideDone: Record<string, number[]>
  /** True once the reader picked Scroll or Book themselves. Phones default to Scroll until then. */
  layoutChosen: boolean
  /** How many times the full open ritual has played. Returning readers get a shorter one. */
  ritualsSeen: number
  markGuideDayDone: (planId: string, day: number, totalDays: number) => void
  unmarkGuideDay: (planId: string, day: number) => void
  chooseLayoutMode: (m: 'scroll' | 'book') => void
  noteRitualSeen: () => void
  setPlace: (p: Place) => void
  setGuideProgress: (planId: string, day: number) => void
  addRecent: (p: Place) => void
  toggleVerseMark: (book: string, chapter: number, verse: number) => void
  toggleStrongBookmark: (strong: string) => void
  setReadSize: (n: 0 | 1 | 2) => void
  setLayoutMode: (m: 'scroll' | 'book') => void
  setReadMode: (m: ReadMode) => void
  setAudioMuted: (m: boolean) => void
  setChamberResumeAt: (t: number | null) => void
  armReaderSettle: () => void
  consumeReaderSettle: () => boolean
  setOpenHandoffFrame: (url: string | null) => void
  clearOpenHandoffFrame: () => void
  touchDay: () => void
  cacheNamed: (key: string, value: unknown) => void
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function computeStreak(days: string[]): number {
  if (!days.length) return 0
  const sorted = [...new Set(days)].sort().reverse()
  let streak = 0
  const cur = new Date()
  for (const d of sorted) {
    const key = cur.toISOString().slice(0, 10)
    if (d === key) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else break
  }
  return streak
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      place: { book: 'gen', chapter: 1 },
      recents: [],
      bookmarks: [],
      verseMarks: [],
      daysOpened: [],
      streak: 0,
      namedQueries: {},
      readSize: 1,
      layoutMode: 'book',
      readMode: 'en',
      audioMuted: false,
      chamberResumeAt: null,
      readerSettlePending: false,
      openHandoffFrame: null,
      guidePlanId: null,
      guideDay: 0,
      guideDone: {},
      layoutChosen: false,
      ritualsSeen: 0,
      markGuideDayDone: (planId, day, totalDays) =>
        set((s) => {
          const done = new Set(s.guideDone[planId] ?? [])
          done.add(day)
          // Move "today" to the next unfinished day after this one (or stay on the last day).
          let next = day
          for (let i = day + 1; i < totalDays; i++) {
            if (!done.has(i)) {
              next = i
              break
            }
          }
          if (next === day) {
            for (let i = 0; i < totalDays; i++) {
              if (!done.has(i)) {
                next = i
                break
              }
            }
          }
          return {
            guideDone: { ...s.guideDone, [planId]: [...done].sort((a, b) => a - b) },
            guidePlanId: planId,
            guideDay: next,
          }
        }),
      unmarkGuideDay: (planId, day) =>
        set((s) => ({
          guideDone: {
            ...s.guideDone,
            [planId]: (s.guideDone[planId] ?? []).filter((d) => d !== day),
          },
        })),
      chooseLayoutMode: (m) => set({ layoutMode: m, layoutChosen: true }),
      noteRitualSeen: () => set((s) => ({ ritualsSeen: (s.ritualsSeen ?? 0) + 1 })),
      setPlace: (p) => {
        set({ place: p })
        get().addRecent(p)
      },
      addRecent: (p) =>
        set((s) => {
          const key = `${p.book}-${p.chapter}`
          const rest = s.recents.filter((r) => `${r.book}-${r.chapter}` !== key)
          return { recents: [p, ...rest].slice(0, 20) }
        }),
      toggleVerseMark: (book, chapter, verse) =>
        set((s) => {
          const i = s.verseMarks.findIndex(
            (m) => m.book === book && m.chapter === chapter && m.verse === verse,
          )
          if (i >= 0) {
            const next = [...s.verseMarks]
            next.splice(i, 1)
            return { verseMarks: next }
          }
          return {
            verseMarks: [
              ...s.verseMarks,
              { book, chapter, verse, at: Date.now() },
            ],
          }
        }),
      toggleStrongBookmark: (strong) =>
        set((s) => {
          const id = strong.toUpperCase()
          const i = s.bookmarks.findIndex((b) => b.strong === id)
          if (i >= 0) {
            const next = [...s.bookmarks]
            next.splice(i, 1)
            return { bookmarks: next }
          }
          return { bookmarks: [...s.bookmarks, { strong: id, at: Date.now() }] }
        }),
      setReadSize: (n) => set({ readSize: n }),
      setLayoutMode: (m) => set({ layoutMode: m }),
      setReadMode: (m) => set({ readMode: m }),
      setAudioMuted: (m) => set({ audioMuted: m }),
      setChamberResumeAt: (t) => set({ chamberResumeAt: t }),
      armReaderSettle: () => set({ readerSettlePending: true }),
      consumeReaderSettle: () => {
        const pending = get().readerSettlePending
        if (pending) set({ readerSettlePending: false })
        return pending
      },
      setOpenHandoffFrame: (url) => set({ openHandoffFrame: url }),
      clearOpenHandoffFrame: () => set({ openHandoffFrame: null }),
      setGuideProgress: (planId, day) => set({ guidePlanId: planId, guideDay: day }),
      touchDay: () =>
        set((s) => {
          const t = todayKey()
          if (s.daysOpened.includes(t)) return s
          const daysOpened = [...s.daysOpened, t].slice(-60)
          return { daysOpened, streak: computeStreak(daysOpened) }
        }),
      cacheNamed: (key, value) =>
        set((s) => ({
          namedQueries: { ...s.namedQueries, [key]: value },
        })),
    }),
    {
      name: 'immersive-bible-v1',
      version: 3,
      partialize: (state) => {
        const {
          readerSettlePending: _omitSettle,
          openHandoffFrame: _omitHandoff,
          ...rest
        } = state
        return rest
      },
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<AppState> & Record<string, unknown>
        // v1 had layoutMode defaulting to scroll; new sessions get book.
        // Keep an explicit user choice if they already toggled (any persisted value).
        if (version < 2) {
          if (p.layoutMode !== 'scroll' && p.layoutMode !== 'book') {
            p.layoutMode = 'book'
          }
          // First open after chamber prefers book: if never set, use book.
          // Users who lived on the old default 'scroll' without touching it
          // still have 'scroll' persisted; leave that alone.
          if (p.readMode !== 'en' && p.readMode !== 'gap' && p.readMode !== 'orig') {
            p.readMode = 'en'
          }
          if (typeof p.chamberResumeAt !== 'number') p.chamberResumeAt = null
        }
        // v3: add guide ticks, layout choice flag and ritual count. Keep everything else as saved.
        if (version < 3) {
          if (!p.guideDone || typeof p.guideDone !== 'object') {
            // Days before the saved "today" in the active plan count as done.
            const done: Record<string, number[]> = {}
            if (typeof p.guidePlanId === 'string' && typeof p.guideDay === 'number' && p.guideDay > 0) {
              done[p.guidePlanId] = Array.from({ length: p.guideDay }, (_, i) => i)
            }
            p.guideDone = done
          }
          // The old open ritual forced Book every time, so the saved layout was never a real choice.
          if (typeof p.layoutChosen !== 'boolean') p.layoutChosen = false
          if (typeof p.ritualsSeen !== 'number') {
            p.ritualsSeen = Array.isArray(p.daysOpened) && p.daysOpened.length > 0 ? 1 : 0
          }
        }
        return p as AppState
      },
    },
  ),
)
