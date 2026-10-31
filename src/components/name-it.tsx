import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { nameCircumstance, SITUATIONS, type NameResult } from '../lib/circumstance'

const labelOf = (id: string) => SITUATIONS.find((s) => s.id === id)?.label ?? id

export function NameIt({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const [asked, setAsked] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<NameResult | null>(null)

  const run = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setAsked(trimmed)
    try {
      setRes(await nameCircumstance(trimmed))
    } finally {
      setLoading(false)
    }
  }

  const pick = (id: string) => {
    const label = labelOf(id)
    setQ(label)
    void run(label)
  }

  useEffect(() => {
    if (initialQuery) void run(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  const activeId = res?.situation?.id

  return (
    <div>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(q)
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Grief, fear, a hospital visit, waiting…"
          aria-label="Name the circumstance"
        />
        <button type="submit" className="reader-ghost search-submit">
          Find verses
        </button>
      </form>
      <div className="chamber-row chip-row" role="group" aria-label="Topics" style={{ marginTop: '1rem' }}>
        {SITUATIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`reader-ghost${activeId === s.id ? ' active' : ''}`}
            aria-pressed={activeId === s.id}
            onClick={() => pick(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {loading && <p className="muted">Listening…</p>}
      {res && !loading && (
        <div className="name-result-head" role="status">
          {res.source === 'curated' && res.situation && (
            <p className="muted">
              Verses for <strong>{res.situation.label.toLowerCase()}</strong>
              {asked.toLowerCase() !== res.situation.label.toLowerCase() ? `, from "${asked}"` : ''}.
            </p>
          )}
          {res.source === 'nearest' && res.situation && (
            <p className="muted">
              No exact match for "{asked}". The closest topic is <strong>{res.situation.label}</strong>.
            </p>
          )}
          {res.source === 'keyword' && (
            <p className="muted">No topic matched "{asked}", so these are verses that use your words.</p>
          )}
          {res.note && <p className="muted">{res.note}</p>}
          {res.related && res.related.length > 0 && (
            <div className="chamber-row">
              <span className="muted">Also close:</span>
              {res.related.map((id) => (
                <button key={id} type="button" className="reader-ghost" onClick={() => pick(id)}>
                  {labelOf(id)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {res?.matches.map((m) => (
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
