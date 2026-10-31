import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { formatRef, getBook, nextPlace, prevPlace } from '../lib/bible/books'
import { loadChapter } from '../lib/bible/load'
import { playPageTurn } from '../lib/page-turn'
import { firstThenSensePerChapter, type ThenCard } from '../lib/then-sense'
import { useAppStore } from '../lib/store'
import type { OrigWord, ReadMode } from '../lib/bible/types'
import type { WordPanelTarget } from './word-panel'
import { LoadError } from './load-error'
import { pressable } from './pressable'

type ChapterData = {
  book: string
  chapter: number
  en: string[]
  orig: OrigWord[][] | null
}

type PageSlice = {
  book: string
  chapter: number
  from: number
  to: number
  heading: boolean
  /** A single verse taller than the page: that page may scroll. */
  tall?: boolean
}

type Land = 'start' | 'end'

const FLIP_MS = 560
const SWIPE_PX = 45
/** Small safety margin so sub-pixel rounding never clips the last line. */
const SAFETY_PX = 3

export function BookReader({
  book,
  chapter,
  mode,
  readSize,
  highlightVerse,
  onWord,
  onChapterChange,
  endAction,
}: {
  book: string
  chapter: number
  mode: ReadMode
  readSize: 0 | 1 | 2
  highlightVerse?: number
  onWord: (t: WordPanelTarget) => void
  onChapterChange: (book: string, chapter: number) => void
  /** Shown in the chrome on the last page of the chapter (for example Mark day done). */
  endAction?: ReactNode
}) {
  const marks = useAppStore((s) => s.verseMarks)
  const [data, setData] = useState<ChapterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [pages, setPages] = useState<PageSlice[]>([])
  const [spread, setSpread] = useState(0)
  const [zoom, setZoom] = useState<'none' | 'left' | 'right'>('none')
  const [flip, setFlip] = useState<'none' | 'next' | 'prev'>('none')
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const [trim, setTrim] = useState(0)
  const flipping = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const lastTap = useRef<{ t: number; side: 'left' | 'right' } | null>(null)
  const pendingLand = useRef<Land | null>(null)
  const dataRef = useRef<ChapterData | null>(null)
  dataRef.current = data
  /** The chapter this component moved to itself, so the route update does not reset the page. */
  const selfNav = useRef<{ book: string; chapter: number } | null>(null)

  const [singlePage, setSinglePage] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setSinglePage(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const cur = dataRef.current
    if (cur && cur.book === book && cur.chapter === chapter && !failed) return
    const own = selfNav.current
    if (own && own.book === book && own.chapter === chapter && cur?.book === book) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setFailed(false)
      setZoom('none')
      try {
        const ch = await loadChapter(book, chapter)
        if (!alive) return
        pendingLand.current = 'start'
        setData({ book, chapter, ...ch })
      } catch {
        if (alive) {
          setData(null)
          setPages([])
          setFailed(true)
        }
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter, retryKey])

  const isHebrew = getBook(data?.book ?? book)?.testament === 'ot'
  const chips = useMemo(() => (data ? firstThenSensePerChapter(data.en) : new Map()), [data])

  // Track the real size of one page's text box (inside padding). Only while not zoomed.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const read = () => {
      if (zoom !== 'none') return
      const inner = stage.querySelector<HTMLElement>('.book-spread .book-page-left .book-page-inner')
      if (!inner) return
      const cs = getComputedStyle(inner)
      const w = inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const h = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      if (w <= 0 || h <= 0) return
      setBox((b) => (b && Math.abs(b.w - w) < 0.5 && Math.abs(b.h - h) < 0.5 ? b : { w, h }))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [zoom, singlePage, readSize, data == null])

  // Split the chapter into pages using the real rendered verses in a hidden copy of a page.
  useLayoutEffect(() => {
    const measure = measureRef.current
    if (!measure || !data || !box) return
    measure.style.width = `${box.w}px`
    const els = Array.from(measure.querySelectorAll<HTMLElement>('[data-mi]'))
    const heading = measure.querySelector<HTMLElement>('.book-page-heading')
    const budget = Math.max(60, box.h - SAFETY_PX - trim)
    const top0 = els[0]?.offsetTop ?? 0
    const headingBlock = heading ? top0 - heading.offsetTop : 0
    const bottom = (i: number) => els[i].offsetTop + els[i].offsetHeight

    const slices: PageSlice[] = []
    let from = 0
    let first = true
    while (from < els.length) {
      const avail = first ? budget - headingBlock : budget
      let to = from
      while (to + 1 < els.length && bottom(to + 1) - els[from].offsetTop <= avail) to++
      const tall = bottom(to) - els[from].offsetTop > avail
      slices.push({ book: data.book, chapter: data.chapter, from, to, heading: first, tall })
      from = to + 1
      first = false
    }
    if (slices.length === 0) {
      slices.push({ book: data.book, chapter: data.chapter, from: 0, to: -1, heading: true })
    }
    setPages(slices)

    // Read the landing choice now, before the updater runs later.
    const land = pendingLand.current
    pendingLand.current = null
    const per = singlePage ? 1 : 2
    const count = Math.max(1, Math.ceil(slices.length / per))
    let target: number | null = null
    if (land === 'end') target = count - 1
    else if (land === 'start') {
      target = 0
      const hv = highlightVerse
      if (hv != null && Number.isFinite(hv) && hv >= 1 && data.book === book && data.chapter === chapter) {
        const idx = slices.findIndex((p) => hv - 1 >= p.from && hv - 1 <= p.to)
        if (idx >= 0) target = Math.floor(idx / per)
      }
    }
    if (target != null) {
      const t = target
      setSpread(t)
    } else {
      setSpread((s) => Math.min(s, count - 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, readSize, singlePage, box, trim, chips])

  // Belt and braces: if a page still overflows after layout, tighten the budget and split again.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || zoom !== 'none') return
    const inners = stage.querySelectorAll<HTMLElement>('.book-spread .book-page:not(.is-tall) .book-page-inner')
    let over = 0
    inners.forEach((el) => {
      over = Math.max(over, el.scrollHeight - el.clientHeight)
    })
    if (over > 1 && trim < 400) setTrim((t) => t + Math.ceil(over) + 2)
  }, [pages, spread, zoom, trim])

  useEffect(() => {
    setTrim(0)
  }, [box, readSize, mode, data])

  const per = singlePage ? 1 : 2
  const spreadCount = Math.max(1, Math.ceil(pages.length / per))
  const leftPage = pages[spread * per] ?? null
  const rightPage = singlePage ? null : (pages[spread * 2 + 1] ?? null)
  const atEnd = !!data && pages.length > 0 && spread >= spreadCount - 1

  const goChapter = useCallback(
    async (dir: 1 | -1, land: Land) => {
      const cur = dataRef.current ?? { book, chapter }
      const nxt = dir === 1 ? nextPlace(cur.book, cur.chapter) : prevPlace(cur.book, cur.chapter)
      if (!nxt) return null
      try {
        const ch = await loadChapter(nxt.book, nxt.chapter)
        return { book: nxt.book, chapter: nxt.chapter, land, data: { book: nxt.book, chapter: nxt.chapter, ...ch } }
      } catch {
        return { book: nxt.book, chapter: nxt.chapter, land, data: null }
      }
    },
    [book, chapter],
  )

  const commitChapter = useCallback(
    (payload: { book: string; chapter: number; land: Land; data: ChapterData | null }) => {
      setZoom('none')
      setLoading(false)
      if (!payload.data) {
        selfNav.current = null
        setData(null)
        setPages([])
        setFailed(true)
        onChapterChange(payload.book, payload.chapter)
        return
      }
      pendingLand.current = payload.land
      selfNav.current = { book: payload.book, chapter: payload.chapter }
      setData(payload.data)
      onChapterChange(payload.book, payload.chapter)
    },
    [onChapterChange],
  )

  const turn = useCallback(
    async (dir: 1 | -1) => {
      if (flipping.current || flip !== 'none') return
      if (zoom !== 'none') {
        setZoom('none')
        return
      }
      const inChapter = dir === 1 ? spread < spreadCount - 1 : spread > 0
      if (inChapter) {
        flipping.current = true
        setFlip(dir === 1 ? 'next' : 'prev')
        playPageTurn()
        window.setTimeout(() => {
          setSpread((s) => s + dir)
          setFlip('none')
          flipping.current = false
        }, FLIP_MS)
        return
      }
      flipping.current = true
      const payload = await goChapter(dir, dir === 1 ? 'start' : 'end')
      if (!payload) {
        flipping.current = false
        return
      }
      setFlip(dir === 1 ? 'next' : 'prev')
      playPageTurn()
      window.setTimeout(() => commitChapter(payload), Math.floor(FLIP_MS * 0.48))
      window.setTimeout(() => {
        setFlip('none')
        flipping.current = false
      }, FLIP_MS)
    },
    [flip, zoom, spread, spreadCount, goChapter, commitChapter],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (t?.closest?.('[role="dialog"]')) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        void turn(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        void turn(1)
      } else if (e.key === 'Escape' && zoom !== 'none') {
        setZoom('none')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [turn, zoom])

  const swipe = (dx: number, dy: number) => {
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return false
    void turn(dx < 0 ? 1 : -1)
    return true
  }

  // Mouse and pen: pointer events. Touch: touch events, which still fire if the browser takes the gesture.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0) return
    pointer.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    const start = pointer.current
    pointer.current = null
    if (!start || start.id !== e.pointerId) return
    swipe(e.clientX - start.x, e.clientY - start.y)
  }
  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length !== 1) {
      touch.current = null
      return
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: ReactTouchEvent) => {
    const start = touch.current
    touch.current = null
    const t = e.changedTouches[0]
    if (!start || !t) return
    if (swipe(t.clientX - start.x, t.clientY - start.y)) e.preventDefault()
  }

  const handlePageTap = (side: 'left' | 'right') => {
    if (singlePage) return
    const now = Date.now()
    const prev = lastTap.current
    if (prev && prev.side === side && now - prev.t < 320) {
      setZoom((z) => (z === side ? 'none' : side))
      lastTap.current = null
      return
    }
    lastTap.current = { t: now, side }
  }

  const renderVerse = (d: ChapterData, i: number, measureOnly: boolean) => {
    const text = d.en[i]
    const verse = i + 1
    const ow = d.orig?.[i] ?? null
    const marked =
      !measureOnly && marks.some((m) => m.book === d.book && m.chapter === d.chapter && m.verse === verse)
    const caveat: ThenCard | undefined = chips.get(i)
    const hl = !measureOnly && highlightVerse === verse && d.book === book && d.chapter === chapter
    const verseId = measureOnly ? undefined : `v-${d.book}-${d.chapter}-${verse}`
    const verseTarget: WordPanelTarget = {
      kind: 'verse',
      text,
      book: d.book,
      chapter: d.chapter,
      verse,
      words: ow ?? undefined,
    }
    const origWords = (words: OrigWord[]) =>
      words.map((w, wi) => (
        <span
          key={wi}
          className="orig-word"
          {...(measureOnly ? {} : pressable(() =>
            onWord({
              kind: 'orig',
              text: w.t,
              word: w,
              strong: w.s,
              morph: w.m,
              lemma: w.l,
              book: d.book,
              chapter: d.chapter,
              verse,
            })))}
        >
          {w.t}{' '}
        </span>
      ))
    const chip = caveat && (
      <button
        type="button"
        className="caveat-chip"
        title={caveat.then}
        tabIndex={measureOnly ? -1 : undefined}
        onClick={(ev) => {
          ev.stopPropagation()
          onWord(verseTarget)
        }}
      >
        original · {caveat.word}
      </button>
    )
    const verseLine = (key?: number) => (
      <p
        key={key}
        className={`verse${marked ? ' marked' : ''}${hl ? ' is-highlight' : ''}`}
        id={mode === 'gap' || (mode === 'orig' && ow) ? undefined : verseId}
        data-mi={mode === 'gap' || (mode === 'orig' && ow) ? undefined : i}
      >
        <span className="verse-num">{verse}</span>
        <span className="verse-text" {...(measureOnly ? {} : pressable(() => onWord(verseTarget)))}>
          {text}
        </span>
        {chip}
      </p>
    )

    if (mode === 'orig' && ow) {
      return (
        <div key={verse} id={verseId} data-mi={i} className={`gap-row${marked ? ' marked' : ''}`}>
          <div className="muted">
            <span className="verse-num">{verse}</span>
          </div>
          <div className={`orig-line${isHebrew ? '' : ' greek'}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            {origWords(ow)}
          </div>
        </div>
      )
    }
    if (mode === 'gap') {
      return (
        <div key={verse} id={verseId} data-mi={i} className={`gap-row${marked ? ' marked' : ''}`}>
          {verseLine()}
          {ow && (
            <div className={`orig-line${isHebrew ? '' : ' greek'}`} dir={isHebrew ? 'rtl' : 'ltr'}>
              {origWords(ow)}
            </div>
          )}
        </div>
      )
    }
    return verseLine(verse)
  }

  const renderPage = (slice: PageSlice | null, side: 'left' | 'right') => {
    if (!slice || !data) {
      return (
        <div className={`book-page book-page-${side} book-page-blank`} aria-hidden>
          <div className="book-page-inner">
            {side === 'left' && failed && (
              <LoadError book={book} chapter={chapter} onRetry={() => setRetryKey((k) => k + 1)} />
            )}
            {side === 'left' && loading && !failed && <p className="muted book-loading">Opening…</p>}
          </div>
        </div>
      )
    }
    const verses = []
    for (let i = slice.from; i <= slice.to; i++) {
      if (i < 0 || i >= data.en.length) continue
      verses.push(renderVerse(data, i, false))
    }
    return (
      <div
        className={`book-page book-page-${side}${slice.tall ? ' is-tall' : ''}${zoom === side ? ' is-zoomed' : ''}${zoom !== 'none' && zoom !== side ? ' is-dimmed' : ''}`}
        onClick={() => handlePageTap(side)}
        role="presentation"
      >
        <div className="book-page-inner">
          {slice.heading && <h2 className="book-page-heading">{formatRef(slice.book, slice.chapter)}</h2>}
          {verses}
        </div>
      </div>
    )
  }

  const label = data ? formatRef(data.book, data.chapter) : formatRef(book, chapter)

  return (
    <div
      className={`book-reader reader-size-${readSize}${zoom !== 'none' ? ' is-zoomed' : ''}${singlePage ? ' is-single' : ''}`}
    >
      <div
        className="book-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touch.current = null
        }}
      >
        <div
          className={`book-spread${flip !== 'none' ? ` is-flipping flip-${flip}` : ''}${zoom !== 'none' ? ` zoom-${zoom}` : ''}`}
        >
          <div className="book-spine" aria-hidden />
          {renderPage(leftPage, 'left')}
          {renderPage(rightPage, 'right')}
          {flip !== 'none' && <div className={`book-flip-sheet flip-${flip}`} aria-hidden />}
        </div>
        {data && (
          <div ref={measureRef} className="book-page book-measure-page" aria-hidden>
            <div className="book-page-inner">
              <h2 className="book-page-heading">{formatRef(data.book, data.chapter)}</h2>
              {data.en.map((_, i) => renderVerse(data, i, true))}
            </div>
          </div>
        )}
      </div>

      <div className="book-chrome">
        <button type="button" className="reader-ghost book-nav" aria-label="Previous page" onClick={() => void turn(-1)}>
          «
        </button>
        <span className="book-chrome-label muted" aria-live="polite">
          {loading && !data ? 'Opening…' : label}
          {data && pages.length > 0 && (
            <>
              {' · '}
              {singlePage ? 'page' : 'pages'} {singlePage ? spread + 1 : `${spread * 2 + 1}${rightPage ? `-${spread * 2 + 2}` : ''}`} of{' '}
              {pages.length}
            </>
          )}
        </span>
        {atEnd && endAction}
        {!singlePage && (
          <div className="book-chrome-zoom">
            <button
              type="button"
              className={`reader-ghost${zoom === 'left' ? ' active' : ''}`}
              aria-pressed={zoom === 'left'}
              aria-label="Enlarge left page"
              onClick={() => setZoom((z) => (z === 'left' ? 'none' : 'left'))}
            >
              Left page
            </button>
            <button
              type="button"
              className={`reader-ghost${zoom === 'none' ? ' active' : ''}`}
              aria-pressed={zoom === 'none'}
              aria-label="Show both pages"
              onClick={() => setZoom('none')}
            >
              Both
            </button>
            <button
              type="button"
              className={`reader-ghost${zoom === 'right' ? ' active' : ''}`}
              aria-pressed={zoom === 'right'}
              aria-label="Enlarge right page"
              onClick={() => setZoom((z) => (z === 'right' ? 'none' : 'right'))}
            >
              Right page
            </button>
          </div>
        )}
        <button type="button" className="reader-ghost book-nav" aria-label="Next page" onClick={() => void turn(1)}>
          »
        </button>
      </div>
    </div>
  )
}
