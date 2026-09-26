/** Vite `base` — always ends with `/` (e.g. `/` or `/immersive-bible/`). */
export const BASE_URL = import.meta.env.BASE_URL

/** Resolve a site-root path against the Vite base (GitHub Pages project path). */
export function asset(path: string): string {
  const clean = path.replace(/^\//, '')
  return `${BASE_URL}${clean}`
}
