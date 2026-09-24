import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
  errorComponent: RootError,
})

function RootError() {
  return (
    <div
      className="page-shell"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <h1 style={{ margin: 0 }}>Something went wrong</h1>
      <p className="muted" style={{ margin: 0 }}>
        The page could not be shown. You can return home and try again.
      </p>
      <div className="chamber-row">
        <Link to="/" className="reader-ghost">
          Home
        </Link>
      </div>
    </div>
  )
}
