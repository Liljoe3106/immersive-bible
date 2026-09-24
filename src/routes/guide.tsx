import { Outlet, createFileRoute } from '@tanstack/react-router'

/** Layout only so /guide/$plan can nest under /guide. */
export const Route = createFileRoute('/guide')({
  component: () => <Outlet />,
})
