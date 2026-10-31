import { Link } from '@tanstack/react-router'
import { formatRef } from '../lib/bible/books'
import { useAppStore } from '../lib/store'

/** Shown when a chapter cannot load: offline and not saved yet, or a network error. */
export function LoadError({
  book,
  chapter,
  onRetry,
}: {
  book: string
  chapter: number
  onRetry?: () => void
}) {
  const recents = useAppStore((s) => s.recents)
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const back = recents.find((r) => !(r.book === book && r.chapter === chapter) && r.book !== book)
  return (
    <div className="load-error" role="status">
      <h2 className="load-error-title">
        {offline ? 'Not saved for offline yet' : 'This chapter did not load'}
      </h2>
      <p>
        {offline
          ? `You are offline, and ${formatRef(book, chapter)} has not been saved on this device yet. Books you have opened before still work. This one will be ready once you open it with a connection.`
          : `${formatRef(book, chapter)} could not be fetched. Check your connection and try again.`}
      </p>
      <div className="chamber-row">
        {onRetry && (
          <button type="button" className="reader-ghost" onClick={onRetry}>
            Try again
          </button>
        )}
        {back && (
          <Link
            to="/read/$book/$chapter"
            params={{ book: back.book, chapter: String(back.chapter) }}
            className="reader-ghost"
          >
            Back to {formatRef(back.book, back.chapter)}
          </Link>
        )}
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
      </div>
    </div>
  )
}
