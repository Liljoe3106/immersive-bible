import { Link } from '@tanstack/react-router'
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
  return (
    <div className="book-index">
      <p className="book-index-eyebrow">Genesis to Revelation</p>
      <h1 className="book-index-title">The book, in order.</h1>
      <p className="book-index-sub">
        Sixty-six books, front to back. Open a chapter and keep going — scroll, swipe, or turn the
        page. Search is a side door, not the entrance.
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
            {booksInSection(section).map((book) => (
              <Link
                key={book.id}
                to="/read/$book/$chapter"
                params={{ book: book.id, chapter: '1' }}
                className="book-index-row"
              >
                <span className="book-index-name">{book.name}</span>
                {book.native && (
                  <span className="book-index-native" dir="auto" lang={book.testament === 'ot' ? 'he' : 'el'}>
                    {book.native}
                  </span>
                )}
                <span className="book-index-ch">{book.chapters} ch.</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
