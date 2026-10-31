// Book view verse coverage: every verse of John 3, Psalm 119 and Genesis 1 must appear in full
// on some page, at phone (390x844) and desktop (1440x900) sizes, in several text sizes and modes.
import { chromium, devices } from 'playwright-core'
import fs from 'node:fs'

// Usage: npm run qa:verses            (checks the live site)
//        QA_BASE=http://127.0.0.1:4173/immersive-bible/ npm run qa:verses
// Needs Chrome/Chromium: set CHROME=/path/to/chrome if it is not at /usr/bin/google-chrome.
const BASE = process.env.QA_BASE || 'https://liljoe3106.github.io/immersive-bible/'
async function launch({ mobile }) {
  const dir = fs.mkdtempSync('/tmp/verse-cov-')
  const opts = mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }
    : { viewport: { width: 1440, height: 900 } }
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, ...opts })
  const page = ctx.pages()[0]
  const log = []
  page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message))
  return { ctx, page, log }
}
const CHAPTERS = [['jhn', 3, 36], ['psa', 119, 176], ['gen', 1, 31]]
const CONFIGS = (process.env.CONFIGS || 'en:0,en:1,en:2,gap:1').split(',').map((c) => c.split(':'))
const SIZES = [['phone', true], ['desktop', false]]
let failures = 0
const report = []
for (const [sizeName, mobile] of SIZES) {
  const { ctx, page, log } = await launch({ mobile })
  for (const [mode, readSize] of CONFIGS) {
    // Write settings from a same-origin non-app URL so the running app cannot overwrite them.
    await page.goto(BASE + 'manifest.webmanifest')
    await page.evaluate((rs) => {
      const raw = localStorage.getItem('immersive-bible-v1')
      const st = raw ? JSON.parse(raw) : { state: {}, version: 3 }
      st.state = { ...st.state, layoutMode: 'book', layoutChosen: true, readSize: Number(rs) }
      st.version = 3
      localStorage.setItem('immersive-bible-v1', JSON.stringify(st))
    }, readSize)
    for (const [book, ch, expected] of CHAPTERS) {
      await page.goto(`${BASE}read/${book}/${ch}?mode=${mode}`)
      await page.waitForSelector('.book-spread .book-page:not(.book-page-blank)', { timeout: 20000 })
      await page.waitForTimeout(600)
      const seen = new Set()
      const problems = []
      let pagesSeen = 0
      for (let guard = 0; guard < 200; guard++) {
        const info = await page.evaluate(({ book, ch }) => {
          const label = document.querySelector('.book-chrome-label')?.textContent || ''
          const ids = []
          const issues = []
          for (const pg of document.querySelectorAll('.book-spread .book-page:not(.book-page-blank)')) {
            const inner = pg.querySelector('.book-page-inner')
            const ir = inner.getBoundingClientRect()
            const cs = getComputedStyle(inner)
            const top = ir.top + parseFloat(cs.paddingTop) - 1
            const bottom = ir.bottom - parseFloat(cs.paddingBottom) + 1
            if (!pg.classList.contains('is-tall') && inner.scrollHeight > inner.clientHeight + 1) issues.push(`overflow ${inner.scrollHeight - inner.clientHeight}px`)
            for (const el of pg.querySelectorAll(`[id^="v-${book}-${ch}-"]`)) {
              const r = el.getBoundingClientRect()
              const v = Number(el.id.split('-').pop())
              if (r.top >= top && r.bottom <= bottom) ids.push(v)
              else if (!pg.classList.contains('is-tall')) issues.push(`v${v} cut (top ${Math.round(r.top - top)}, bottom over ${Math.round(r.bottom - bottom)})`)
              else ids.push(v)
            }
          }
          return { label, ids, issues, pages: document.querySelectorAll('.book-spread .book-page:not(.book-page-blank)').length }
        }, { book, ch })
        if (!info.label.toLowerCase().includes(String(ch))) break
        const chName = info.label.split('·')[0].trim()
        if (guard > 0 && !new RegExp(`\\b${ch}$`).test(chName)) break
        info.ids.forEach((v) => seen.add(v))
        info.issues.forEach((x) => problems.push(`${info.label}: ${x}`))
        pagesSeen += info.pages
        const m = info.label.match(/of (\d+)/)
        const pm = info.label.match(/pages? ([\d-]+) of/)
        const last = m && pm && Number(pm[1].split('-').pop()) >= Number(m[1])
        if (last) break
        const before = info.label
        await page.keyboard.press('ArrowRight')
        await page.waitForFunction((b) => document.querySelector('.book-chrome-label')?.textContent !== b, before, { timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(150)
      }
      const missing = []
      for (let v = 1; v <= expected; v++) if (!seen.has(v)) missing.push(v)
      const ok = missing.length === 0 && problems.length === 0
      if (!ok) failures++
      const line = `${ok ? 'PASS' : 'FAIL'} ${sizeName} ${mode} size${readSize} ${book} ${ch}: ${seen.size}/${expected} verses on ${pagesSeen} pages${missing.length ? ' missing ' + missing.join(',') : ''}${problems.length ? ' problems: ' + problems.slice(0, 5).join('; ') : ''}`
      report.push(line)
      console.log(line)
    }
  }
  if (log.length) console.log(sizeName, 'console:', log.slice(0, 5).join('\n'))
  await ctx.close()
}
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
