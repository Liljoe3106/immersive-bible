import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { BASE_URL } from './lib/asset'
import './styles.css'

const basepath = BASE_URL.replace(/\/$/, '') || undefined

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  ...(basepath ? { basepath } : {}),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${BASE_URL}sw.js`).catch(() => {})
  })
}
