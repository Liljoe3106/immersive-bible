import { Link, createFileRoute } from '@tanstack/react-router'
import { BookIndex } from '../components/book-index'

export const Route = createFileRoute('/read/')({
  component: ReadIndexPage,
})

function ReadIndexPage() {
  return (
    <div className="page-shell">
      <div className="chamber-row" style={{ marginBottom: '1.25rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/search" className="reader-ghost">
          Search
        </Link>
        <Link to="/gallery" className="reader-ghost">
          Original
        </Link>
        <Link to="/guide" className="reader-ghost">
          Guide
        </Link>
      </div>
      <BookIndex />
    </div>
  )
}
