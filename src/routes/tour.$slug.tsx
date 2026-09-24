import { Link, createFileRoute } from '@tanstack/react-router'
import { TourWalk } from '../components/tour-walk'

export const Route = createFileRoute('/tour/$slug')({
  component: TourPage,
})

function TourPage() {
  const { slug } = Route.useParams()

  if (slug !== 'bereshit') {
    return (
      <div className="page-shell">
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <h1>Tour</h1>
        <p className="muted">Unknown walk. Try bereshit.</p>
        <Link to="/tour/$slug" params={{ slug: 'bereshit' }} className="reader-ghost">
          Bereshit
        </Link>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="chamber-row" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/read" className="reader-ghost">
          Read
        </Link>
        <Link to="/read/$book/$chapter" params={{ book: 'gen', chapter: '1' }} className="reader-ghost">
          Genesis 1
        </Link>
      </div>
      <TourWalk />
    </div>
  )
}
