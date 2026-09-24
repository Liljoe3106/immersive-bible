import { Link, createFileRoute } from '@tanstack/react-router'
import { THEN_CARDS } from '../lib/then-sense'

export const Route = createFileRoute('/gallery')({
  component: GalleryPage,
})

function GalleryPage() {
  return (
    <div className="page-shell">
      <div className="chamber-row" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/read" className="reader-ghost">
          Read
        </Link>
        <Link to="/guide" className="reader-ghost">
          Guide
        </Link>
      </div>
      <p className="gallery-eyebrow">Hebrew & Greek behind the English</p>
      <h1 className="gallery-title">Original translation</h1>
      <p className="muted gallery-lead">
        These cards show what the original wording was doing: the Hebrew or Greek sense behind the English,
        not a sermon and not a systematic theology.
      </p>
      <div className="gallery-grid">
        {THEN_CARDS.map((c) => (
          <div className="gallery-card" key={c.id}>
            <h3>{c.then}</h3>
            <p className="gallery-meta">
              {[c.xlit, c.strongs?.[0], c.native].filter(Boolean).join(' · ') || c.word}
            </p>
            <p>{c.note}</p>
            <div className="chamber-row" style={{ marginTop: '0.75rem' }}>
              {c.strongs?.map((s) => (
                <Link key={s} to="/word/$strong" params={{ strong: s }} className="reader-ghost">
                  {s}
                </Link>
              ))}
              {!c.strongs?.length && (
                <span className="caveat-chip" style={{ marginLeft: 0 }}>
                  {c.word}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
