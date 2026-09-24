import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { loadStrongs } from '../lib/bible/load'
import type { StrongEntry } from '../lib/bible/types'
import { BOOK_ALIASES } from '../lib/bible/books'
import { THEN_CARDS, thenCardById } from '../lib/then-sense'
import { useAppStore } from '../lib/store'

export const Route = createFileRoute('/word/$strong')({
  component: WordPage,
})

function parseOpenRef(ref: string): { book: string; chapter: number; verse?: number } | null {
  const m = ref.trim().match(/^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+))?$/)
  if (!m) return null
  const name = m[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const book = BOOK_ALIASES[name] ?? BOOK_ALIASES[name.replace(/\s/g, '')]
  if (!book) return null
  return {
    book,
    chapter: Number(m[2]),
    verse: m[3] ? Number(m[3]) : undefined,
  }
}

function WordPage() {
  const { strong: raw } = Route.useParams()
  const strong = raw.toUpperCase()
  const [entry, setEntry] = useState<StrongEntry | null>(null)
  const toggle = useAppStore((s) => s.toggleStrongBookmark)
  const bookmarks = useAppStore((s) => s.bookmarks)
  const saved = bookmarks.some((b) => b.strong === strong)
  const then = THEN_CARDS.filter((c) => c.strongs?.includes(strong))
  const primary = then[0] ?? thenCardById(strong)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const all = await loadStrongs()
      if (!alive) return
      setEntry(all[strong] ?? null)
    })()
    return () => {
      alive = false
    }
  }, [strong])

  const title = primary?.then ?? entry?.xlit ?? strong
  const meta = [
    primary?.xlit || entry?.xlit,
    strong,
    primary?.native || entry?.lemma,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="page-shell word-page">
      <div className="chamber-row" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/gallery" className="reader-ghost">
          Original
        </Link>
      </div>

      {primary && <p className="word-page-eyebrow">Original translation</p>}
      <h1 className="word-page-title">{title}</h1>
      <p className="word-page-meta muted">{meta}</p>

      {primary?.longThen ? (
        <p className="word-page-long">{primary.longThen}</p>
      ) : primary ? (
        <p className="word-page-long">{primary.then}. {primary.note}</p>
      ) : entry ? (
        <div className="card">
          <h3>
            {entry.lemma} {entry.xlit ? `· ${entry.xlit}` : ''}
          </h3>
          <p>{entry.strongs_def || entry.kjv_def}</p>
          {entry.kjv_def && <p className="muted">KJV gloss: {entry.kjv_def}</p>}
          {entry.der && <p className="muted">{entry.der}</p>}
        </div>
      ) : (
        <p className="muted">No lexicon entry in the shipped subset.</p>
      )}

      {primary && (
        <>
          <hr className="word-page-rule" />
          <blockquote className="word-page-quote">"{primary.note.replace(/^"|"$/g, '')}"</blockquote>
          {primary.native && (
            <p className="muted">
              In {strong.startsWith('G') ? 'Greek' : 'Hebrew'}:{' '}
              <span dir="auto" lang={strong.startsWith('G') ? 'el' : 'he'}>
                {primary.native}
              </span>
            </p>
          )}
          <ul className="word-page-refs">
            {primary.refs.map((r) => {
              const parsed = parseOpenRef(r)
              if (!parsed) {
                return (
                  <li key={r}>
                    <span>{r}</span>
                  </li>
                )
              }
              return (
                <li key={r}>
                  <Link
                    to="/read/$book/$chapter"
                    params={{ book: parsed.book, chapter: String(parsed.chapter) }}
                    search={parsed.verse ? { v: parsed.verse } : {}}
                  >
                    Open {r}
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="chamber-row" style={{ marginTop: '1.25rem' }}>
            <Link to="/name" search={{ q: primary.then }} className="book-index-cta">
              Ask for an original
            </Link>
            <Link to="/search" search={{ q: primary.word }} className="reader-ghost">
              Search "{primary.word}"
            </Link>
            <button
              type="button"
              className={`reader-ghost${saved ? ' active' : ''}`}
              onClick={() => toggle(strong)}
            >
              {saved ? 'Bookmarked' : 'Bookmark'}
            </button>
          </div>
        </>
      )}

      {!primary && (
        <button
          type="button"
          className={`reader-ghost${saved ? ' active' : ''}`}
          onClick={() => toggle(strong)}
          style={{ marginTop: '1rem' }}
        >
          {saved ? 'Bookmarked' : 'Bookmark'}
        </button>
      )}

      {then.length > 1 &&
        then.slice(1).map((c) => (
          <div className="card" key={c.id}>
            <h3>Original · {c.then}</h3>
            <p>{c.note}</p>
          </div>
        ))}
    </div>
  )
}
