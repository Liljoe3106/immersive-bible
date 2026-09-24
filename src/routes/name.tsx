import { Link, createFileRoute } from '@tanstack/react-router'
import { NameIt } from '../components/name-it'

export const Route = createFileRoute('/name')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === 'string' ? s.q : undefined,
  }),
  component: NamePage,
})

function NamePage() {
  const { q = '' } = Route.useSearch()
  return (
    <div className="page-shell quiet-chrome">
      <div className="chamber-row page-nav" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/guide" className="reader-ghost">
          Guide
        </Link>
      </div>
      <h1>Name it</h1>
      <p className="muted">Name how you are, then sit with a few scriptures.</p>
      <NameIt initialQuery={q} />
    </div>
  )
}
