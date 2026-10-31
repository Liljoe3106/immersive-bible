import { Link, createFileRoute } from '@tanstack/react-router'
import { READING_PLANS } from '../lib/reading-plans'
import { useAppStore } from '../lib/store'
import { useTitle } from '../hooks/use-title'

export const Route = createFileRoute('/guide/')({
  component: GuideIndexPage,
})

function GuideIndexPage() {
  const guidePlanId = useAppStore((s) => s.guidePlanId)
  const guideDay = useAppStore((s) => s.guideDay)
  const guideDone = useAppStore((s) => s.guideDone)
  useTitle('Reading guide')

  return (
    <div className="page-shell quiet-chrome">
      <div className="chamber-row page-nav" style={{ marginBottom: '1rem' }}>
        <Link to="/" className="reader-ghost">
          Chamber
        </Link>
        <Link to="/read" className="reader-ghost">
          Read
        </Link>
        <Link to="/search" className="reader-ghost">
          Search
        </Link>
        <Link to="/name" className="reader-ghost">
          Name it
        </Link>
      </div>
      <h1>Reading guide</h1>
      <p className="muted" style={{ marginTop: '-0.35rem' }}>
        Practical plans people actually use. Pick one, open today, keep going.
      </p>
      {READING_PLANS.map((plan) => {
        const inProgress = guidePlanId === plan.id
        const done = (guideDone[plan.id] ?? []).length
        return (
          <div className="card" key={plan.id}>
            <h3>
              <Link
                to="/guide/$plan"
                params={{ plan: plan.id }}
                style={{ color: '#7a5d10' }}
              >
                {plan.name}
              </Link>
            </h3>
            <p>{plan.blurb}</p>
            <p className="muted">
              {plan.days.length} day{plan.days.length === 1 ? '' : 's'}
              {inProgress ? ` · today is day ${guideDay + 1}` : ''}
              {done > 0 ? ` · ${done} done ✓` : ''}
            </p>
            <div className="chamber-row" style={{ marginTop: '0.65rem' }}>
              <Link to="/guide/$plan" params={{ plan: plan.id }} className="reader-ghost">
                {inProgress || done > 0 ? 'Continue' : 'Open plan'}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
