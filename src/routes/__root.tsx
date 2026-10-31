import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useTitle } from '../hooks/use-title'

export const Route = createRootRoute({
  component: () => (
    <main id="main" className="app-main">
      <Outlet />
    </main>
  ),
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

/** Dark, candlelit "lost page" for any unknown address. */
function NotFound() {
  useTitle('Page not found')
  return (
    <div className="lost-room">
      <div className="lost-room-inner">
        <p className="chamber-room-label">Page not found</p>
        <h1 className="chamber-room-headline">This page is not in the book.</h1>
        <p className="chamber-room-line">
          The link may be old or mistyped. Go back to the room, or pick up the book where you choose.
        </p>
        <div className="chamber-row">
          <Link to="/" className="chamber-ghost chamber-primary">
            Back to the Chamber
          </Link>
          <Link to="/read" className="chamber-ghost">
            Read
          </Link>
        </div>
      </div>
    </div>
  )
}

function RootError() {
  useTitle('Something went wrong')
  return (
    <div className="lost-room">
      <div className="lost-room-inner">
        <p className="chamber-room-label">Something went wrong</p>
        <h1 className="chamber-room-headline">The page could not be shown.</h1>
        <p className="chamber-room-line">Go back to the room and try again.</p>
        <div className="chamber-row">
          <Link to="/" className="chamber-ghost chamber-primary">
            Back to the Chamber
          </Link>
          <Link to="/read" className="chamber-ghost">
            Read
          </Link>
        </div>
      </div>
    </div>
  )
}
