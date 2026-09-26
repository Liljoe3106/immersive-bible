import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

// Set GITHUB_PAGES=true in CI so asset URLs use `/immersive-bible/`. Local dev/build stay at `/`.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/immersive-bible/' : '/',
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    excludeChamberBackup(),
    spaFallback404(),
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
