import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { runSearch, type SearchResult } from '../lib/bible/search'
import { matchThenCardQuery } from '../lib/then-sense'
import { useTitle } from '../hooks/use-title'

export const Route = createFileRoute('/search')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === 'string' ? s.q : undefined,
  }),
  component: SearchPage,
})

function SearchPage() {
  const { q: initial = '' } = Route.useSearch()
  const navigate = useNavigate()
  const [q, setQ] = useState(initial)
  const [results, setResults] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [total, setTotal] = useState(0)
  const [corrected, setCorrected] = useState<string | undefined>()
  useTitle(initial ? `Search: ${initial}` : 'Search')
  const thenHit = initial.trim() ? matchThenCardQuery(initial) : undefined

  useEffect(() => {
    setQ(initial)
    if (!initial.trim()) {
      setResults([])
      return
    }
    let alive = true
    ;(async () => {
      setBusy(true)
      const out = await runSearch(initial)
      const res = out.results
      if (!alive) return
      if (res.length === 1 && res[0].kind === 'circumstance') {
        void navigate({ to: '/name', search: { q: initial } })
        return
      }
      if (res.length === 1 && res[0].kind === 'ref' && res[0].book && res[0].chapter) {
        void navigate({
          to: '/read/$book/$chapter',
          params: { book: res[0].book, chapter: String(res[0].chapter) },
          search: res[0].verse ? { v: res[0].verse } : {},
        })
        return
      }
      setResults(res)
      setTotal(out.total)
      setCorrected(out.correctedTo)
      setBusy(false)
    })()
    return () => {
      alive = false
    }
  }, [initial, navigate])

  return (
    <div className="page-shell">
      <div className="chamber-row" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/read" className="reader-ghost">
          Read
        </Link>
        <Link to="/gallery" className="reader-ghost">
          Original
        </Link>
        <Link to="/guide" className="reader-ghost">
          Guide
        </Link>
      </div>
      <h1>Search</h1>
      <p className="muted" style={{ marginTop: '-0.35rem' }}>
        A reference, a word, or a phrase in the English text.
      </p>
      <form
        className="search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          void navigate({ to: '/search', search: { q } })
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="John 1:1 · mercy · free text"
          aria-label="Search"
        />
        <button type="submit" className="reader-ghost search-submit">
          Search
        </button>
      </form>

      {thenHit && (
        <div className="search-then">
          <p className="search-then-eyebrow">Original translation</p>
          {thenHit.strongs?.[0] ? (
            <Link
              to="/word/$strong"
              params={{ strong: thenHit.strongs[0] }}
              className="search-then-card"
            >
              <h2>{thenHit.then}</h2>
              <p>{thenHit.note}</p>
              <p className="search-then-meta">
                {[thenHit.xlit, thenHit.strongs[0], thenHit.native].filter(Boolean).join(' · ')}
              </p>
            </Link>
          ) : (
            <Link to="/gallery" className="search-then-card">
              <h2>{thenHit.then}</h2>
              <p>{thenHit.note}</p>
              <p className="search-then-meta">{thenHit.word}</p>
            </Link>
          )}
        </div>
      )}

      {busy && <p className="muted">Searching…</p>}
      {!busy && results.length > 0 && (
        <p className="search-results-label muted" role="status">
          {corrected ? (
            <>
              No verses use "{initial}". Showing results for <strong>{corrected}</strong>.{' '}
            </>
          ) : null}
          {total > results.length
            ? `Showing the first ${results.length} of ${total} verses (KJV).`
            : `${total} ${total === 1 ? 'verse' : 'verses'} (KJV).`}
        </p>
      )}
      {!busy &&
        results.map((r, i) => (
          <div className="card" key={i}>
            {r.book && r.chapter ? (
              <h3>
                <Link
                  to="/read/$book/$chapter"
                  params={{ book: r.book, chapter: String(r.chapter) }}
                  search={r.verse ? { v: r.verse } : {}}
                  style={{ color: '#7a5d10' }}
                >
                  {r.ref}
                </Link>
              </h3>
            ) : (
              <h3>{r.ref}</h3>
            )}
            {r.text && <p>{r.text}</p>}
          </div>
        ))}
      {!busy && initial && results.length === 0 && !thenHit && (
        <p className="muted" role="status">
          No verses match "{initial}". Try a reference like John 3:16, a single word, or{' '}
          <Link to="/name" search={{ q: initial }} style={{ color: '#7a5d10' }}>
            name what you are going through
          </Link>
          .
        </p>
      )}
    </div>
  )
}
