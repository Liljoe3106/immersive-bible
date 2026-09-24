import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { formatRef, getBook, nextPlace, prevPlace } from '../lib/bible/books'
import { loadChapter } from '../lib/bible/load'
import { playPageTurn } from '../lib/page-turn'
import { notableThenSense } from '../lib/then-sense'
import { useAppStore } from '../lib/store'
import type { OrigWord, ReadMode } from '../lib/bible/types'
import type { WordPanelTarget } from './word-panel'

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
}

const FLIP_MS = 560
const SWIPE_PX = 50

export function BookReader({
  book,
  chapter,
  mode,
  readSize,
  highlightVerse,
  onWord,
  onChapterChange,
}: {
  book: string
  chapter: number
  mode: ReadMode
  readSize: 0 | 1 | 2
  highlightVerse?: number
  onWord: (t: WordPanelTarget) => void
  onChapterChange: (book: string, chapter: number) => void
}) {
  const marks = useAppStore((s) => s.verseMarks)
  const [data, setData] = useState<ChapterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState<PageSlice[]>([])
  const [spread, setSpread] = useState(0)
  const [zoom, setZoom] = useState<'none' | 'left' | 'right'>('none')
  const [flip, setFlip] = useState<'none' | 'next' | 'prev'>('none')
  const flipping = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null)
  const lastTap = useRef<{ t: number; side: 'left' | 'right' } | null>(null)
  const pendingLand = useRef<'start' | 'end' | null>(null)
  const dataRef = useRef<ChapterData | null>(null)
  dataRef.current = data

  const [singlePage, setSinglePage] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setSinglePage(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const cur = dataRef.current
    if (cur && cur.book === book && cur.chapter === chapter) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setZoom('none')
      try {
        const ch = await loadChapter(book, chapter)
        if (!alive) return
        setData({ book, chapter, ...ch })
        setSpread(0)
      } catch {
        if (alive) setData(null)
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [book, chapter])

  const isHebrew = getBook(data?.book ?? book)?.testament === 'ot'

  useLayoutEffect(() => {
    const stage = stageRef.current
    const measure = measureRef.current
    if (!stage || !measure || !data) return

    const compute = () => {
      // Account for page-inner padding so Size 2+ does not clip past the panel.
      const padY = 36
      const pageH = Math.max(160, stage.clientHeight - 8 - padY)
      const colW = singlePage
        ? Math.max(120, Math.floor(stage.clientWidth - 32))
        : Math.max(120, Math.floor((stage.clientWidth - 48) / 2))
      measure.style.width = `${colW}px`
      measure.innerHTML = ''

      const heading = document.createElement('h3')
      heading.className = 'book-page-heading'
      heading.textContent = formatRef(data.book, data.chapter)
      measure.appendChild(heading)
      const headingH = heading.offsetHeight + 12

      const verseEls: HTMLElement[] = []
      for (let i = 0; i < data.en.length; i++) {
        const wrap = document.createElement('div')
        wrap.className = 'book-measure-verse'
        if (mode === 'orig' && data.orig?.[i]) {
          wrap.innerHTML = `<span class="verse-num">${i + 1}</span><span class="orig-line${isHebrew ? '' : ' greek'}">${escapeHtml(data.orig[i].map((w) => w.t).join(' '))}</span>`
        } else if (mode === 'gap') {
          const ow = data.orig?.[i]
          wrap.innerHTML = `<p class="verse"><span class="verse-num">${i + 1}</span>${escapeHtml(data.en[i])}</p>${
            ow
              ? `<div class="orig-line${isHebrew ? '' : ' greek'}">${escapeHtml(ow.map((w) => w.t).join(' '))}</div>`
              : ''
          }`
        } else {
          wrap.innerHTML = `<p class="verse"><span class="verse-num">${i + 1}</span>${escapeHtml(data.en[i])}</p>`
        }
        measure.appendChild(wrap)
        verseEls.push(wrap)
      }

      const slices: PageSlice[] = []
      let from = 0
      let used = 0
      let first = true
      const budget = () => (first ? pageH - headingH : pageH)

      for (let i = 0; i < verseEls.length; i++) {
        const h = verseEls[i].offsetHeight + 4
        if (used > 0 && used + h > budget()) {
          slices.push({
            book: data.book,
            chapter: data.chapter,
            from,
            to: i - 1,
            heading: first,
          })
          from = i
          used = 0
          first = false
        }
        used += h
      }
      if (data.en.length === 0) {
        slices.push({
          book: data.book,
          chapter: data.chapter,
          from: 0,
          to: -1,
          heading: true,
        })
      } else if (from < data.en.length) {
        slices.push({
          book: data.book,
          chapter: data.chapter,
          from,
          to: data.en.length - 1,
          heading: first,
        })
      }
      setPages(slices)
      setSpread((s) => {
        const sp = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
        const count = Math.max(1, sp ? slices.length : Math.ceil(slices.length / 2))
        if (pendingLand.current === 'end') return count - 1
        if (pendingLand.current === 'start') return 0
        // Land spread on ?v= when opening a chapter with a verse highlight.
        const hv = highlightVerse
        if (hv != null && Number.isFinite(hv) && hv >= 1) {
          const idx = slices.findIndex((p) => hv - 1 >= p.from && hv - 1 <= p.to)
          if (idx >= 0) return sp ? idx : Math.floor(idx / 2)
        }
        return Math.min(s, count - 1)
      })
      pendingLand.current = null
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [data, mode, readSize, isHebrew, highlightVerse, singlePage])

  const spreadCount = Math.max(1, singlePage ? pages.length : Math.ceil(pages.length / 2))
  const leftPage = singlePage ? (pages[spread] ?? null) : (pages[spread * 2] ?? null)
  const rightPage = singlePage ? null : (pages[spread * 2 + 1] ?? null)

  const goChapter = useCallback(
    async (dir: 1 | -1, land: 'start' | 'end') => {
      const cur = dataRef.current ?? { book, chapter }
      const nxt = dir === 1 ? nextPlace(cur.book, cur.chapter) : prevPlace(cur.book, cur.chapter)
      if (!nxt) return null
      try {
        const ch = await loadChapter(nxt.book, nxt.chapter)
        return { book: nxt.book, chapter: nxt.chapter, land, data: { book: nxt.book, chapter: nxt.chapter, ...ch } }
      } catch {
        return null
      }
    },
    [book, chapter],
  )

  const commitChapter = useCallback(
    (
      payload: { book: string; chapter: number; land: 'start' | 'end'; data: ChapterData },
    ) => {
      pendingLand.current = payload.land
      setData(payload.data)
      setZoom('none')
      setLoading(false)
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

      if (dir === 1) {
        if (spread < spreadCount - 1) {
          flipping.current = true
          setFlip('next')
          playPageTurn()
          window.setTimeout(() => {
            setSpread((s) => s + 1)
            setFlip('none')
            flipping.current = false
          }, FLIP_MS)
          return
        }
        // Prefetch next chapter while holding current spread; commit at flip midpoint.
        const payload = await goChapter(1, 'start')
        if (!payload) return
        flipping.current = true
        setFlip('next')
        playPageTurn()
        window.setTimeout(() => {
          commitChapter(payload)
        }, Math.floor(FLIP_MS * 0.48))
        window.setTimeout(() => {
          setFlip('none')
          flipping.current = false
        }, FLIP_MS)
        return
      }

      if (spread > 0) {
        flipping.current = true
        setFlip('prev')
        playPageTurn()
        window.setTimeout(() => {
          setSpread((s) => s - 1)
          setFlip('none')
          flipping.current = false
        }, FLIP_MS)
        return
      }
      const payload = await goChapter(-1, 'end')
      if (!payload) return
      flipping.current = true
      setFlip('prev')
      playPageTurn()
      window.setTimeout(() => {
        commitChapter(payload)
      }, Math.floor(FLIP_MS * 0.48))
      window.setTimeout(() => {
        setFlip('none')
        flipping.current = false
      }, FLIP_MS)
    },
    [flip, zoom, spread, spreadCount, goChapter, commitChapter],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        void turn(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        void turn(1)
      } else if (e.key === 'Escape' && zoom !== 'none') {
        setZoom('none')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [turn, zoom])

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    pointer.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = pointer.current
    pointer.current = null
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return
    if (dx < 0) void turn(1)
    else void turn(-1)
  }

  const handlePageTap = (side: 'left' | 'right') => {
    const now = Date.now()
    const prev = lastTap.current
    if (prev && prev.side === side && now - prev.t < 320) {
      setZoom((z) => (z === side ? 'none' : side))
      lastTap.current = null
      return
    }
    lastTap.current = { t: now, side }
  }

  const renderPage = (slice: PageSlice | null, side: 'left' | 'right') => {
    if (!slice || !data) {
      return (
        <div className={`book-page book-page-${side} book-page-blank`} aria-hidden>
          <div className="book-page-inner" />
        </div>
      )
    }
    const s = slice
    const verses = []
    for (let i = s.from; i <= s.to; i++) {
      if (i < 0 || i >= data.en.length) continue
      const text = data.en[i]
      const verse = i + 1
      const ow = data.orig?.[i] ?? null
      const marked = marks.some(
        (m) => m.book === s.book && m.chapter === s.chapter && m.verse === verse,
      )
      const caveat = notableThenSense(text)
      const hl =
        highlightVerse === verse && s.book === book && s.chapter === chapter
      const verseId = `v-${s.book}-${s.chapter}-${verse}`
      const verseTarget: WordPanelTarget = {
        kind: 'verse',
        text,
        book: s.book,
        chapter: s.chapter,
        verse,
        words: ow ?? undefined,
      }

      if (mode === 'orig' && ow) {
        verses.push(
          <div key={verse} id={verseId} className={`gap-row${marked ? ' marked' : ''}`}>
            <div className="muted">
              <span className="verse-num">{verse}</span>
            </div>
            <div
              className={`orig-line${isHebrew ? '' : ' greek'}`}
              dir={isHebrew ? 'rtl' : 'ltr'}
            >
              {ow.map((w, wi) => (
                <span
                  key={wi}
                  className="orig-word"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onWord({
                      kind: 'orig',
                      text: w.t,
                      word: w,
                      strong: w.s,
                      morph: w.m,
                      lemma: w.l,
                      book: s.book,
                      chapter: s.chapter,
                      verse,
                    })
                  }}
                >
                  {w.t}{' '}
                </span>
              ))}
            </div>
          </div>,
        )
      } else if (mode === 'gap') {
        verses.push(
          <div key={verse} id={verseId} className={`gap-row${marked ? ' marked' : ''}`}>
            <p
              className={`verse${marked ? ' marked' : ''}`}
              style={hl ? { background: 'rgba(201,162,39,0.15)' } : undefined}
            >
              <span className="verse-num">{verse}</span>
              <span
                className="verse-text"
                onClick={(ev) => {
                  ev.stopPropagation()
                  onWord(verseTarget)
                }}
              >
                {text}
              </span>
              {caveat && (
                <span
                  className="caveat-chip"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onWord(verseTarget)
                  }}
                >
                  original · {caveat.word}
                </span>
              )}
            </p>
            {ow && (
              <div
                className={`orig-line${isHebrew ? '' : ' greek'}`}
                dir={isHebrew ? 'rtl' : 'ltr'}
              >
                {ow.map((w, wi) => (
                  <span
                    key={wi}
                    className="orig-word"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onWord({
                        kind: 'orig',
                        text: w.t,
                        word: w,
                        strong: w.s,
                        morph: w.m,
                        lemma: w.l,
                        book: s.book,
                        chapter: s.chapter,
                        verse,
                      })
                    }}
                  >
                    {w.t}{' '}
                  </span>
                ))}
              </div>
            )}
          </div>,
        )
      } else {
        verses.push(
          <p
            key={verse}
            className={`verse${marked ? ' marked' : ''}`}
            id={verseId}
            style={hl ? { background: 'rgba(201,162,39,0.15)' } : undefined}
          >
            <span className="verse-num">{verse}</span>
            <span
              className="verse-text"
              onClick={(ev) => {
                ev.stopPropagation()
                onWord(verseTarget)
              }}
            >
              {text}
            </span>
            {caveat && (
              <span
                className="caveat-chip"
                title={caveat.then}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onWord(verseTarget)
                }}
              >
                original · {caveat.word}
              </span>
            )}
          </p>,
        )
      }
    }

    return (
      <div
        className={`book-page book-page-${side}${zoom === side ? ' is-zoomed' : ''}${zoom !== 'none' && zoom !== side ? ' is-dimmed' : ''}`}
        onClick={() => handlePageTap(side)}
        role="presentation"
      >
        <div className="book-page-inner">
          {s.heading && (
            <h3 className="book-page-heading">{formatRef(s.book, s.chapter)}</h3>
          )}
          {verses}
        </div>
      </div>
    )
  }

  const label = useMemo(() => {
    if (!data) return formatRef(book, chapter)
    return formatRef(data.book, data.chapter)
  }, [data, book, chapter])

  return (
    <div className={`book-reader reader-size-${readSize}${zoom !== 'none' ? ' is-zoomed' : ''}${singlePage ? ' is-single' : ''}`}>
      <div
        className="book-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null
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
        <div
          ref={measureRef}
          className={`book-measure reader-size-${readSize}`}
          aria-hidden
        />
      </div>

      <div className="book-chrome">
        <button
          type="button"
          className="reader-ghost book-nav"
          aria-label="Previous page"
          onClick={() => void turn(-1)}
        >
          «
        </button>
        <span className="book-chrome-label muted">
          {loading && !data ? 'Opening…' : label}
          {data && pages.length > 0 && (
            <>
              {' · '}
              {spread + 1}/{spreadCount}
            </>
          )}
        </span>
        <div className="book-chrome-zoom">
          <button
            type="button"
            className={`reader-ghost${zoom === 'left' ? ' active' : ''}`}
            aria-label="Zoom left page"
            onClick={() => setZoom((z) => (z === 'left' ? 'none' : 'left'))}
          >
            L+
          </button>
          <button
            type="button"
            className={`reader-ghost${zoom === 'none' ? ' active' : ''}`}
            aria-label="Full spread"
            onClick={() => setZoom('none')}
          >
            Spread
          </button>
          <button
            type="button"
            className={`reader-ghost${zoom === 'right' ? ' active' : ''}`}
            aria-label="Zoom right page"
            onClick={() => setZoom((z) => (z === 'right' ? 'none' : 'right'))}
          >
            R+
          </button>
        </div>
        <button
          type="button"
          className="reader-ghost book-nav"
          aria-label="Next page"
          onClick={() => void turn(1)}
        >
          »
        </button>
      </div>
    </div>
  )
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
