import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { BOOKS, getBook } from '../lib/bible/books'

/** Grid of chapter numbers for one book. */
export function ChapterGrid({
  book,
  current,
  onPick,
}: {
  book: string
  current?: number
  onPick?: () => void
}) {
  const b = getBook(book)
  if (!b) return null
  return (
    <div className="chapter-grid" aria-label={`${b.name} chapters`}>
      {Array.from({ length: b.chapters }, (_, i) => i + 1).map((c) => (
        <Link
          key={c}
          to="/read/$book/$chapter"
          params={{ book, chapter: String(c) }}
          className={`chapter-cell${c === current ? ' active' : ''}`}
          aria-current={c === current ? 'page' : undefined}
          aria-label={`${b.name} ${c}`}
          onClick={onPick}
        >
          {c}
        </Link>
      ))}
    </div>
  )
}

/** Dialog opened from the reader's place label: pick a chapter, or switch book. */
export function ChapterPicker({
  book,
  chapter,
  onClose,
}: {
  book: string
  chapter: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const b = getBook(book)
  const idx = BOOKS.findIndex((x) => x.id === book)
  const prev = idx > 0 ? BOOKS[idx - 1] : null
  const next = idx >= 0 && idx < BOOKS.length - 1 ? BOOKS[idx + 1] : null

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.querySelector<HTMLElement>('.chapter-cell.active, .chapter-cell')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      } else if (e.key === 'Tab' && el) trapTab(e, el)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="picker-scrim" onClick={onClose}>
      <div
        ref={ref}
        className="chapter-picker"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a chapter of ${b?.name ?? book}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chapter-picker-head">
          <h2>{b?.name ?? book}</h2>
          <button type="button" className="reader-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <ChapterGrid book={book} current={chapter} onPick={onClose} />
        <div className="chamber-row chapter-picker-foot">
          {prev && (
            <Link
              to="/read/$book/$chapter"
              params={{ book: prev.id, chapter: '1' }}
              className="reader-ghost"
              onClick={onClose}
            >
              ‹ {prev.name}
            </Link>
          )}
          <Link to="/read" className="reader-ghost" onClick={onClose}>
            All books
          </Link>
          {next && (
            <Link
              to="/read/$book/$chapter"
              params={{ book: next.id, chapter: '1' }}
              className="reader-ghost"
              onClick={onClose}
            >
              {next.name} ›
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

/** Keep Tab focus inside a dialog. */
export function trapTab(e: KeyboardEvent, root: HTMLElement) {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"]), summary',
    ),
  ).filter((x) => x.offsetParent !== null || x === document.activeElement)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && (active === first || !root.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}
