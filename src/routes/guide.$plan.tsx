import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { formatDayReading, getPlan } from '../lib/reading-plans'
import { useAppStore } from '../lib/store'
import { useTitle } from '../hooks/use-title'

export const Route = createFileRoute('/guide/$plan')({
  component: GuidePlanPage,
})

function GuidePlanPage() {
  const { plan: planId } = Route.useParams()
  const plan = getPlan(planId)
  const guidePlanId = useAppStore((s) => s.guidePlanId)
  const guideDay = useAppStore((s) => s.guideDay)
  const setGuideProgress = useAppStore((s) => s.setGuideProgress)
  const guideDone = useAppStore((s) => s.guideDone)
  const markDone = useAppStore((s) => s.markGuideDayDone)
  const unmark = useAppStore((s) => s.unmarkGuideDay)
  useTitle(plan ? plan.name : 'Reading plan')

  if (!plan) throw notFound()
  const done = new Set(guideDone[plan.id] ?? [])

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
        {done.has(currentDay) ? ' ✓ done' : ''}
      </p>
      <div className="guide-progress" aria-label={`${done.size} of ${plan.days.length} days done`}>
        <div className="guide-progress-bar" style={{ width: `${(done.size / plan.days.length) * 100}%` }} />
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        {done.size} of {plan.days.length} days done
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
        {!done.has(currentDay) ? (
          <button
            type="button"
            className="reader-ghost guide-done-btn"
            onClick={() => markDone(plan.id, currentDay, plan.days.length)}
          >
            Mark day {currentDay + 1} done
          </button>
        ) : (
          <button type="button" className="reader-ghost" onClick={() => unmark(plan.id, currentDay)}>
            Undo day {currentDay + 1} done
          </button>
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
              {done.has(i) && (
                <span className="guide-tick" aria-label="Done">
                  ✓{' '}
                </span>
              )}
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
              {!active && (
                <button
                  type="button"
                  className="reader-ghost"
                  onClick={() => setGuideProgress(plan.id, i)}
                >
                  Set as today
                </button>
              )}
              <button
                type="button"
                className={`reader-ghost${done.has(i) ? ' active' : ''}`}
                aria-pressed={done.has(i)}
                onClick={() => (done.has(i) ? unmark(plan.id, i) : markDone(plan.id, i, plan.days.length))}
              >
                {done.has(i) ? 'Done ✓' : 'Mark done'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
