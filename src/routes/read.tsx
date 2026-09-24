import { Outlet, createFileRoute } from '@tanstack/react-router'

/** Layout only — redirect lives on `/read/` index so child routes are not wrapped by it. */
export const Route = createFileRoute('/read')({
  component: () => <Outlet />,
})
