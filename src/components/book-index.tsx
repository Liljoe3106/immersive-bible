import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChapterGrid } from './chapter-picker'
import {
  BOOK_SECTIONS,
  TOTAL_CHAPTERS,
  booksInSection,
} from '../lib/bible/books'

/** Compact decorative dots — one cluster per book, scaled by chapter count. */
function ProgressDots() {
  const dots: { key: string; size: number }[] = []
  for (const section of BOOK_SECTIONS) {
    for (const book of booksInSection(section)) {
      // Cap visual weight so Psalms doesn't dominate the strip
      const n = Math.min(12, Math.max(1, Math.round(book.chapters / 8)))
      for (let i = 0; i < n; i++) {
        dots.push({ key: `${book.id}-${i}`, size: book.chapters })
      }
    }
  }
  return (
    <div className="book-index-dots" aria-hidden>
      {dots.map((d) => (
        <span key={d.key} className="book-index-dot" />
      ))}
    </div>
  )
}

export function BookIndex() {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="book-index">
      <p className="book-index-eyebrow">Genesis to Revelation</p>
      <h1 className="book-index-title">The book, in order.</h1>
      <p className="book-index-sub">
        Sixty-six books, front to back. Tap a book to choose a chapter, then keep going: scroll down,
        or in Book view swipe or tap the arrows to turn the page.
      </p>
      <p className="book-index-stats muted">
        {TOTAL_CHAPTERS.toLocaleString('en-GB')} chapters · Genesis to Revelation
      </p>
      <ProgressDots />
      <div className="book-index-cta-row">
        <Link to="/read/$book/$chapter" params={{ book: 'gen', chapter: '1' }} className="book-index-cta">
          Begin at Genesis
        </Link>
      </div>

      {BOOK_SECTIONS.map((section) => (
        <section key={section.id} className="book-index-section">
          <h2 className="book-index-section-label">{section.label}</h2>
          <div className="book-index-list">
            {booksInSection(section).map((book) => {
              const row = (
                <>
                  <span className="book-index-name">{book.name}</span>
                  {book.native && (
                    <span className="book-index-native" dir="auto" lang={book.testament === 'ot' ? 'he' : 'el'}>
                      {book.native}
                    </span>
                  )}
                  <span className="book-index-ch">
                    {book.chapters === 1 ? '1 chapter' : `${book.chapters} chapters`}
                  </span>
                </>
              )
              if (book.chapters === 1) {
                return (
                  <Link
                    key={book.id}
                    to="/read/$book/$chapter"
                    params={{ book: book.id, chapter: '1' }}
                    className="book-index-row"
                  >
                    {row}
                  </Link>
                )
              }
              const isOpen = open === book.id
              return (
                <div key={book.id} className={`book-index-item${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="book-index-row"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : book.id)}
                  >
                    {row}
                  </button>
                  {isOpen && <ChapterGrid book={book.id} />}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
