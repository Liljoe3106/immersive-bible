import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { nameCircumstance, SITUATIONS, type SituationMatch } from '../lib/circumstance'

export function NameIt({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<SituationMatch[]>([])
  const [note, setNote] = useState<string | undefined>()
  const [source, setSource] = useState<string>('')

  const run = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const res = await nameCircumstance(trimmed)
      setMatches(res.matches)
      setNote(res.note)
      setSource(res.source)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialQuery) void run(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(q)
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Grief, fear, joy, waiting…"
          aria-label="Name the circumstance"
        />
      </form>
      <div className="chamber-row" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
        {SITUATIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="reader-ghost"
            onClick={() => {
              setQ(s.label)
              void run(s.label)
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {loading && <p className="muted">Listening…</p>}
      {source && !loading && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Source: {source}
          {note ? `: ${note}` : ''}
        </p>
      )}
      {matches.map((m) => (
        <div className="card" key={`${m.book}-${m.chapter}-${m.verse}`}>
          <h3>
            <Link
              to="/read/$book/$chapter"
              params={{ book: m.book, chapter: String(m.chapter) }}
              search={{ v: m.verse }}
              style={{ color: '#7a5d10' }}
            >
              {m.ref}
            </Link>
          </h3>
          <p>{m.text}</p>
        </div>
      ))}
    </div>
  )
}
