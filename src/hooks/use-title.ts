import { useEffect } from 'react'

const SITE = 'The Immersive Bible'

/** Per-page document title, for tabs, history and screen readers. */
export function useTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE
  }, [title])
}
