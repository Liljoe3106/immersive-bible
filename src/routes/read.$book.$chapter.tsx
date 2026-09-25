import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { BookReader } from '../components/book-reader'
import { ChapterBlock } from '../components/chapter-block'
import { WordPanel, type WordPanelTarget } from '../components/word-panel'
import { loadChapter } from '../lib/bible/load'
import { nextPlace, formatRef, getBook } from '../lib/bible/books'
import { useAppStore } from '../lib/store'
import { bindAmbientGesture, startAmbient } from '../lib/ambient'
import { useAmbientSound } from '../hooks/use-ambient-label'
import type { OrigWord, ReadMode } from '../lib/bible/types'

type Chunk = {
  book: string
  chapter: number
  en: string[]
  orig: OrigWord[][] | null
}

function chunkKey(c: { book: string; chapter: number }) {
  return `${c.book}-${c.chapter}`
}

/** Survives React StrictMode remount so settle still plays once per chamber arrival. */
let readerSettleLatch = false

export const Route = createFileRoute('/read/$book/$chapter')({
  validateSearch: (s: Record<string, unknown>): { v?: number; w?: string; mode?: ReadMode } => ({
    v: s.v != null && s.v !== '' ? Number(s.v) : undefined,
    w: typeof s.w === 'string' ? s.w : undefined,
    mode: s.mode === 'gap' || s.mode === 'orig' || s.mode === 'en' ? (s.mode as ReadMode) : undefined,
  }),
  component: ReaderPage,
})

function ReaderPage() {
  const { book, chapter: chapterStr } = Route.useParams()
  const chapter = Number(chapterStr)
  const search = Route.useSearch()
  const navigate = useNavigate()
  const setPlace = useAppStore((s) => s.setPlace)
  const readSize = useAppStore((s) => s.readSize)
  const setReadSize = useAppStore((s) => s.setReadSize)
  const layoutMode = useAppStore((s) => s.layoutMode)
  const setLayoutMode = useAppStore((s) => s.setLayoutMode)
  const readMode = useAppStore((s) => s.readMode)
  const setReadMode = useAppStore((s) => s.setReadMode)
  const { label: soundLabel, toggle: toggleSound, active: soundActive } = useAmbientSound()

  const [chunks, setChunks] = useState<Chunk[]>([])
  const [panel, setPanel] = useState<WordPanelTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [settleIn, setSettleIn] = useState(() => {
    if (readerSettleLatch) return true
    const pending = useAppStore.getState().consumeReaderSettle()
    if (!pending) return false
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    } catch {
      /* */
    }
    readerSettleLatch = true
    return true
  })
  /** Latch chamber open last-frame underlay once; clear store after fade. */
  const [handoffUrl] = useState(() => useAppStore.getState().openHandoffFrame)
  const [handoffOn, setHandoffOn] = useState(() => !!useAppStore.getState().openHandoffFrame)
  const [handoffFading, setHandoffFading] = useState(false)
  const clearOpenHandoffFrame = useAppStore((s) => s.clearOpenHandoffFrame)
  const settleRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMore = useRef(false)
  const initialDone = useRef(false)
  const endRef = useRef<{ book: string; chapter: number }>({ book, chapter })
  const seenKeys = useRef<Set<string>>(new Set())
  const lastScrollY = useRef(0)

  const mode = search.mode ?? readMode ?? 'en'
  const isBook = layoutMode === 'book'

  useEffect(() => {
    startAmbient()
    bindAmbientGesture()
  }, [])

  // Clear settle class after animation (armed only once via consume on mount).
  useEffect(() => {
    if (!settleIn) return
    const clear = () => {
      readerSettleLatch = false
      setSettleIn(false)
    }
    const t = window.setTimeout(clear, 3500)
    const el = settleRef.current
    const onEnd = (e: AnimationEvent) => {
      if (e.target !== el) return
      if (e.animationName !== 'reader-settle-in') return
      clear()
    }
    el?.addEventListener('animationend', onEnd)
    return () => {
      window.clearTimeout(t)
      el?.removeEventListener('animationend', onEnd)
    }
  }, [settleIn])

  // Fade last-frame underlay after text/chrome ready; then drop from store.
  useEffect(() => {
    if (!handoffUrl || !handoffOn) return
    let fadeT = 0
    let clearT = 0
    const startFade = () => {
      setHandoffFading(true)
      clearT = window.setTimeout(() => {
        setHandoffOn(false)
        clearOpenHandoffFrame()
      }, 1100)
    }
    // Keep underlay through early settle (~1.2s), then soft fade to live vellum.
    fadeT = window.setTimeout(startFade, settleIn ? 1200 : 800)
    return () => {
      window.clearTimeout(fadeT)
      window.clearTimeout(clearT)
    }
  }, [handoffUrl, handoffOn, settleIn, clearOpenHandoffFrame])

  useEffect(() => {
    if (search.mode && search.mode !== readMode) {
      setReadMode(search.mode)
    } else if (!search.mode && readMode) {
      void navigate({
        to: '/read/$book/$chapter',
        params: { book, chapter: String(chapter) },
        search: { ...search, mode: readMode },
        replace: true,
      })
    }
  }, [search.mode, readMode, book, chapter, navigate, search, setReadMode])

  useEffect(() => {
    setPlace({ book, chapter, verse: search.v })
    if (isBook) {
      setLoading(false)
      initialDone.current = true
      if (search.w) setPanel({ kind: 'orig', text: search.w, strong: search.w })
      return
    }
    let alive = true
    initialDone.current = false
    loadingMore.current = true
    ;(async () => {
      setLoading(true)
      const loaded: Chunk[] = []
      const keys = new Set<string>()
      let cur: { book: string; chapter: number } | null = { book, chapter }
      for (let i = 0; i < 4 && cur; i++) {
        const k = chunkKey(cur)
        if (keys.has(k)) break
        try {
          const data = await loadChapter(cur.book, cur.chapter)
          loaded.push({ book: cur.book, chapter: cur.chapter, ...data })
          keys.add(k)
          cur = nextPlace(cur.book, cur.chapter)
        } catch {
          break
        }
      }
      if (!alive) return
      seenKeys.current = keys
      setChunks(loaded)
      endRef.current = loaded.length
        ? { book: loaded[loaded.length - 1].book, chapter: loaded[loaded.length - 1].chapter }
        : { book, chapter }
      setLoading(false)
      initialDone.current = true
      loadingMore.current = false
      if (search.v) {
        requestAnimationFrame(() => {
          document.getElementById(`v-${book}-${chapter}-${search.v}`)?.scrollIntoView({
            block: 'center',
          })
        })
      }
      if (search.w) {
        setPanel({ kind: 'orig', text: search.w, strong: search.w })
      }
    })()
    return () => {
      alive = false
    }
  }, [book, chapter, search.v, search.w, setPlace, isBook])

  const loadMore = useCallback(async () => {
    if (!initialDone.current || loadingMore.current || isBook) return
    loadingMore.current = true
    const nxt = nextPlace(endRef.current.book, endRef.current.chapter)
    if (!nxt) {
      loadingMore.current = false
      return
    }
    const k = chunkKey(nxt)
    if (seenKeys.current.has(k)) {
      endRef.current = nxt
      loadingMore.current = false
      return
    }
    try {
      const data = await loadChapter(nxt.book, nxt.chapter)
      setChunks((prev) => {
        if (prev.some((c) => chunkKey(c) === k)) return prev
        seenKeys.current.add(k)
        const next = [...prev, { book: nxt.book, chapter: nxt.chapter, ...data }]
        const sliced = next.slice(-12)
        seenKeys.current = new Set(sliced.map(chunkKey))
        return sliced
      })
      endRef.current = nxt
    } catch {
      /* end */
    }
    loadingMore.current = false
  }, [isBook])

  useEffect(() => {
    if (isBook || loading || !initialDone.current) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, chunks.length, isBook, loading])

  useEffect(() => {
    if (isBook || !chunks.length) return

    const pickVisibleChapter = () => {
      const blocks = document.querySelectorAll<HTMLElement>('.chapter-block')
      if (!blocks.length) return
      const anchor = 72
      let best: HTMLElement | null = null
      let bestDist = Infinity
      for (const el of blocks) {
        const heading = el.querySelector('h2') ?? el
        const top = heading.getBoundingClientRect().top
        const dist = Math.abs(top - anchor)
        if (dist < bestDist) {
          bestDist = dist
          best = el
        }
      }
      if (!best) return
      const b = best.dataset.book
      const c = Number(best.dataset.chapter)
      if (!b || !Number.isFinite(c)) return
      const cur = useAppStore.getState().place
      if (cur.book === b && cur.chapter === c) return
      setPlace({ book: b, chapter: c })
    }

    const io = new IntersectionObserver(() => pickVisibleChapter(), {
      root: null,
      rootMargin: '-64px 0px -55% 0px',
      threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
    })
    document.querySelectorAll('.chapter-block').forEach((el) => io.observe(el))
    pickVisibleChapter()
    return () => io.disconnect()
  }, [chunks, setPlace, isBook])

  useEffect(() => {
    let idleTimer = window.setTimeout(() => setChromeHidden(true), 4200)
    const bump = () => {
      setChromeHidden(false)
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => setChromeHidden(true), 4200)
    }
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastScrollY.current + 8 && y > 80) setChromeHidden(true)
      else if (y < lastScrollY.current - 8) bump()
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerdown', bump)
    return () => {
      window.clearTimeout(idleTimer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', bump)
    }
  }, [])

  const setMode = (m: ReadMode) => {
    setReadMode(m)
    void navigate({
      to: '/read/$book/$chapter',
      params: { book, chapter: String(chapter) },
      search: { ...search, mode: m },
      replace: true,
    })
  }

  const onBookChapterChange = useCallback(
    (b: string, c: number) => {
      setPlace({ book: b, chapter: c })
      void navigate({
        to: '/read/$book/$chapter',
        params: { book: b, chapter: String(c) },
        search: { ...search, v: undefined },
        replace: true,
      })
    },
    [navigate, search, setPlace],
  )

  const title = getBook(book)?.name ?? book

  return (
    <div
      className={`reader-shell${isBook ? ' reader-shell-book' : ''}${chromeHidden ? ' chrome-hidden' : ''}${handoffOn ? ' has-handoff' : ''}${handoffOn && !handoffFading ? ' handoff-chrome-in' : ''}`}
    >
      {handoffOn ? (
        handoffUrl ? (
          <img
            className={`reader-handoff-underlay${handoffFading ? ' is-fading' : ''}`}
            src={handoffUrl}
            alt=""
            aria-hidden
            draggable={false}
          />
        ) : (
          <div
            className={`reader-handoff-underlay${handoffFading ? ' is-fading' : ''}`}
            aria-hidden
          />
        )
      ) : null}
      <header className="reader-top">
        <div className="reader-top-side reader-top-view">
          <div className="chamber-row">
            <Link to="/" className="reader-ghost">
              Chamber
            </Link>
            <span className="reader-place">{formatRef(book, chapter)}</span>
          </div>
          <div className="chamber-row reader-top-group" role="group" aria-label="View">
            <span className="reader-top-label">View</span>
            <button
              type="button"
              className={`reader-ghost${layoutMode === 'scroll' ? ' active' : ''}`}
              onClick={() => setLayoutMode('scroll')}
            >
              Scroll
            </button>
            <button
              type="button"
              className={`reader-ghost${layoutMode === 'book' ? ' active' : ''}`}
              onClick={() => setLayoutMode('book')}
            >
              Book
            </button>
            <button
              type="button"
              className={`reader-ghost${soundActive ? ' active' : ''}`}
              title="Heart of Nowhere (Kevin MacLeod, CC BY 3.0)"
              onClick={() => toggleSound()}
            >
              {soundLabel}
            </button>
            <button
              type="button"
              className={`reader-ghost${moreOpen ? ' active' : ''}`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              More
            </button>
          </div>
        </div>
        <div className="reader-top-side reader-top-scripture">
          <div className="chamber-row reader-top-group" role="group" aria-label="Scripture text">
            <span className="reader-top-label">Scripture</span>
            <button
              type="button"
              className={`reader-ghost${mode === 'en' ? ' active' : ''}`}
              onClick={() => setMode('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`reader-ghost${mode === 'gap' ? ' active' : ''}`}
              onClick={() => setMode('gap')}
            >
              Both
            </button>
            <button
              type="button"
              className={`reader-ghost${mode === 'orig' ? ' active' : ''}`}
              onClick={() => setMode('orig')}
            >
              Orig
            </button>
          </div>
        </div>
        {moreOpen && (
          <div className="reader-more">
            <button
              type="button"
              className="reader-ghost"
              onClick={() => setReadSize(((readSize + 1) % 3) as 0 | 1 | 2)}
            >
              Size {readSize}
            </button>
            <Link to="/search" className="reader-ghost" onClick={() => setMoreOpen(false)}>
              Search
            </Link>
            <Link to="/guide" className="reader-ghost" onClick={() => setMoreOpen(false)}>
              Guide
            </Link>
            <Link to="/name" className="reader-ghost" onClick={() => setMoreOpen(false)}>
              Name it
            </Link>
          </div>
        )}
      </header>

      <div
        ref={settleRef}
        className={`reader-settle${settleIn ? ' is-settling' : ''}`}
      >
        {isBook ? (
          <BookReader
            book={book}
            chapter={chapter}
            mode={mode}
            readSize={readSize}
            highlightVerse={search.v}
            onWord={setPanel}
            onChapterChange={onBookChapterChange}
          />
        ) : (
          <main className={`reader-body reader-size-${readSize}`}>
            {loading && <p className="muted">Opening {title}…</p>}
            {chunks.map((c, idx) => (
              <ChapterBlock
                key={chunkKey(c)}
                book={c.book}
                chapter={c.chapter}
                en={c.en}
                orig={c.orig}
                mode={mode}
                highlightVerse={c.book === book && c.chapter === chapter ? search.v : undefined}
                onWord={setPanel}
                showCatches={idx === 0}
              />
            ))}
            <div ref={sentinelRef} style={{ height: 1 }} />
            <p className="muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
              Keep scrolling: next chapter loads quietly.
            </p>
          </main>
        )}
      </div>
      <WordPanel target={panel} onClose={() => setPanel(null)} />
    </div>
  )
}
