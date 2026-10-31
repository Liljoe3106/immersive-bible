import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Skip public/chamber/backup from dist (large QA masters). */
function excludeChamberBackup(): Plugin {
  return {
    name: 'exclude-chamber-backup',
    closeBundle() {
      const dir = path.resolve(__dirname, 'dist/chamber/backup')
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.includes('/chamber/backup/')) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        next()
      })
    },
  }
}

/** After build, copy index.html → 404.html so SPA deep links work on GitHub Pages. */
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const index = path.resolve(__dirname, 'dist/index.html')
      const fallback = path.resolve(__dirname, 'dist/404.html')
      if (fs.existsSync(index)) fs.copyFileSync(index, fallback)
    },
  }
}

/**
 * After build, inject the app-shell precache list and a content hash into dist/sw.js.
 * Big media (chamber videos, ambient bed) and scripture JSON are NOT precached; the
 * service worker caches them at runtime when the reader opens them.
 */
function pwaPrecache(): Plugin {
  const SHELL_FILES = [
    'index.html',
    'manifest.webmanifest',
    'favicon.svg',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-192-maskable.png',
    'chamber/poster.jpg',
    'chamber/parchment.jpg',
    'chamber/open-stills/blank-parchment-best.jpg',
    'chamber/page-turn.mp3',
  ]
  // Font subsets the reader actually needs (English, Hebrew, Greek). Others load on demand.
  const FONT_OK = /-(latin|latin-ext|hebrew|greek|greek-ext)-\d{3}-normal-[^.]+\.woff2$/
  return {
    name: 'pwa-precache',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist')
      const swPath = path.join(dist, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const assets = fs
        .readdirSync(path.join(dist, 'assets'))
        .filter((f) => /\.(js|css)$/.test(f) || FONT_OK.test(f))
        .map((f) => `assets/${f}`)
      const list = [...SHELL_FILES.filter((f) => fs.existsSync(path.join(dist, f))), ...assets.sort()]
      const hash = crypto.createHash('sha256')
      for (const f of list) {
        hash.update(f)
        hash.update(fs.readFileSync(path.join(dist, f)))
      }
      const swSrc = fs.readFileSync(swPath, 'utf8')
      hash.update(swSrc)
      const id = hash.digest('hex').slice(0, 10)
      const out = swSrc
        .replace("'__BUILD_ID__'", JSON.stringify(id))
        .replace('/*__PRECACHE__*/ []', JSON.stringify(list))
      fs.writeFileSync(swPath, out)
    },
  }
}

// Set GITHUB_PAGES=true in CI so asset URLs use `/immersive-bible/`. Local dev/build stay at `/`.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/immersive-bible/' : '/',
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    excludeChamberBackup(),
    spaFallback404(),
    pwaPrecache(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    allowedHosts: true,
  },
})
