import { Link, createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '../lib/store'
import { formatRef } from '../lib/bible/books'
import { useTitle } from '../hooks/use-title'

export const Route = createFileRoute('/marks')({
  component: MarksPage,
})

function MarksPage() {
  useTitle('Marks')
  const verseMarks = useAppStore((s) => s.verseMarks)
  const bookmarks = useAppStore((s) => s.bookmarks)
  const streak = useAppStore((s) => s.streak)
  const toggleMark = useAppStore((s) => s.toggleVerseMark)
  const toggleStrong = useAppStore((s) => s.toggleStrongBookmark)

  return (
    <div className="page-shell">
      <div className="chamber-row" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
      </div>
      <h1>Marks</h1>
      <p className="muted">Local only · streak {streak} day{streak === 1 ? '' : 's'}</p>

      <h2 style={{ fontFamily: 'var(--serif-display)', marginTop: '2rem' }}>Verse marks</h2>
      {verseMarks.length === 0 && <p className="muted">No verse marks yet.</p>}
      {[...verseMarks].reverse().map((m) => (
        <div className="card" key={`${m.book}-${m.chapter}-${m.verse}-${m.at}`}>
          <h3>
            <Link
              to="/read/$book/$chapter"
              params={{ book: m.book, chapter: String(m.chapter) }}
              search={{ v: m.verse }}
              style={{ color: '#7a5d10' }}
            >
              {formatRef(m.book, m.chapter, m.verse)}
            </Link>
          </h3>
          <button
            type="button"
            className="reader-ghost"
            onClick={() => toggleMark(m.book, m.chapter, m.verse)}
          >
            Remove
          </button>
        </div>
      ))}

      <h2 style={{ fontFamily: 'var(--serif-display)', marginTop: '2rem' }}>Strong&apos;s bookmarks</h2>
      {bookmarks.length === 0 && <p className="muted">No Strong&apos;s bookmarks yet.</p>}
      {[...bookmarks].reverse().map((b) => (
        <div className="card" key={`${b.strong}-${b.at}`}>
          <h3>
            <Link to="/word/$strong" params={{ strong: b.strong }} style={{ color: '#7a5d10' }}>
              {b.strong}
            </Link>
          </h3>
          <button type="button" className="reader-ghost" onClick={() => toggleStrong(b.strong)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}
