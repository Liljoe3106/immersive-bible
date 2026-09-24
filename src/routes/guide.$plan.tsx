import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { formatDayReading, getPlan } from '../lib/reading-plans'
import { useAppStore } from '../lib/store'

export const Route = createFileRoute('/guide/$plan')({
  component: GuidePlanPage,
})

function GuidePlanPage() {
  const { plan: planId } = Route.useParams()
  const plan = getPlan(planId)
  const guidePlanId = useAppStore((s) => s.guidePlanId)
  const guideDay = useAppStore((s) => s.guideDay)
  const setGuideProgress = useAppStore((s) => s.setGuideProgress)

  if (!plan) throw notFound()

  const currentDay =
    guidePlanId === plan.id
      ? Math.min(Math.max(guideDay, 0), plan.days.length - 1)
      : 0
  const todayRefs = plan.days[currentDay] ?? []
  const first = todayRefs[0]

  return (
    <div className="page-shell quiet-chrome">
      <div className="chamber-row page-nav" style={{ marginBottom: '1rem' }}>
        <Link to="/guide" className="reader-ghost">
          Guide
        </Link>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/read" className="reader-ghost">
          Read
        </Link>
      </div>
      <h1>{plan.name}</h1>
      <p className="muted" style={{ marginTop: '-0.35rem' }}>
        {plan.blurb}
      </p>
      <p className="muted">
        Day {currentDay + 1} of {plan.days.length}
        {todayRefs.length ? `: ${formatDayReading(todayRefs)}` : ''}
      </p>
      <div className="chamber-row" style={{ marginBottom: '1.25rem' }}>
        {first && (
          <Link
            to="/read/$book/$chapter"
            params={{ book: first.book, chapter: String(first.chapter) }}
            className="reader-ghost"
            onClick={() => setGuideProgress(plan.id, currentDay)}
          >
            Open today
          </Link>
        )}
        {currentDay > 0 && (
          <button
            type="button"
            className="reader-ghost"
            onClick={() => setGuideProgress(plan.id, currentDay - 1)}
          >
            Previous day
          </button>
        )}
        {currentDay < plan.days.length - 1 && (
          <button
            type="button"
            className="reader-ghost"
            onClick={() => setGuideProgress(plan.id, currentDay + 1)}
          >
            Next day
          </button>
        )}
      </div>

      <h2 style={{ fontFamily: 'var(--serif-display)', fontSize: '1.15rem' }}>Days</h2>
      {plan.days.map((refs, i) => {
        const active = guidePlanId === plan.id && i === currentDay
        const lead = refs[0]
        return (
          <div
            className="card"
            key={i}
            style={
              active
                ? { borderColor: 'rgba(122, 93, 16, 0.55)', boxShadow: '0 0 0 1px rgba(122, 93, 16, 0.25)' }
                : undefined
            }
          >
            <h3 style={{ marginBottom: '0.35rem' }}>
              Day {i + 1}
              {active ? ' (today)' : ''}
            </h3>
            <p className="muted" style={{ marginBottom: '0.55rem' }}>
              {formatDayReading(refs)}
            </p>
            <div className="chamber-row">
              {lead && (
                <Link
                  to="/read/$book/$chapter"
                  params={{ book: lead.book, chapter: String(lead.chapter) }}
                  className="reader-ghost"
                  onClick={() => setGuideProgress(plan.id, i)}
                >
                  Open
                </Link>
              )}
              <button
                type="button"
                className="reader-ghost"
                onClick={() => setGuideProgress(plan.id, i)}
              >
                Set as today
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
