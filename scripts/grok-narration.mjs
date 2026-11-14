// Pre-recorded Grok (xAI) narration for the reader. Runs offline on a dev machine, never in the app.
//
//   node scripts/grok-narration.mjs scope                    chapters in order, character count, estimated cost
//   node scripts/grok-narration.mjs audition [outDir]        John 3:16 in each candidate voice
//   node scripts/grok-narration.mjs generate [--budget 10]   record chapters in scope order until the budget is used
//
// Needs XAI_API_KEY in the environment for audition/generate. The key is only sent to api.x.ai;
// it is never written to disk or into the app. Stops at the first 4xx/5xx.
// Output: public/narration/grok/<book>-<chapter>.mp3 (64 kbps mono) + .json (verse start times),
// and src/lib/narration-audio.json (the list of recorded chapters the app checks synchronously).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'public/narration/grok')
const MANIFEST = path.join(ROOT, 'src/lib/narration-audio.json')
const LEDGER = path.join(ROOT, 'scripts/narration-ledger.json')

export const VOICE = process.env.GROK_VOICE || 'lux'
export const SPEED = 0.9
export const CANDIDATES = ['lux', 'orion', 'luna']
/** Text to Speech: $15.00 per 1M characters (docs.x.ai/developers/pricing, read 14 Nov 2026). */
export const USD_PER_CHAR = 15 / 1_000_000
const PART_MAX = 12000

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/catalog.json'), 'utf8')).books
const BOOK = Object.fromEntries(catalog.map((b) => [b.id, b]))
const ids = (t) => catalog.filter((b) => !t || b.testament === t).map((b) => b.id)
const chaptersOf = (bs) => bs.flatMap((id) => Array.from({ length: BOOK[id].chapters }, (_, i) => [id, i + 1]))
const bySize = (list, n) => { const d = []; for (let i = 0; i < list.length; i += n) d.push(list.slice(i, i + n)); return d }
const intoDays = (list, target) => {
  const days = Math.min(target, list.length), base = Math.floor(list.length / days), rem = list.length % days
  const out = []; let i = 0
  for (let d = 0; d < days; d++) { const s = base + (d < rem ? 1 : 0); out.push(list.slice(i, i + s)); i += s }
  return out
}
// Mirrors src/lib/reading-plans.ts
const PLANS = {
  'begin-here': bySize(chaptersOf(['jhn', 'mrk', 'php']), 1),
  gospels: bySize(chaptersOf(['mat', 'mrk', 'luk', 'jhn']), 1),
  'nt-90': intoDays(chaptersOf(ids('nt')), 90),
  'psalms-month': bySize(chaptersOf(['psa']), 5),
  proverbs: bySize(chaptersOf(['pro']), 1),
  'straight-through': bySize(chaptersOf(ids()), 3),
  story: bySize(chaptersOf(['gen', 'exo', 'jos', 'jdg', '1sa', '2sa', '1ki', '2ki', 'ezr', 'neh', 'luk', 'act']), 1),
}
const MOST_READ = [['jhn', 1], ['jhn', 2], ['jhn', 3], ['psa', 23], ['gen', 1], ['rom', 8], ['1co', 13]]

const versesCache = {}
export function verses(book, ch) {
  versesCache[book] ??= JSON.parse(fs.readFileSync(path.join(ROOT, `public/data/en/${book}.json`), 'utf8'))
  return versesCache[book][ch - 1].map((v) => v.replace(/\s+/g, ' ').trim())
}
export function heading(book, ch) {
  return book === 'psa' ? `Psalm ${ch}.` : `${BOOK[book].name}, chapter ${ch}.`
}
/** Spoken text for a chapter and the character offset where each verse starts. */
export function chapterText(book, ch) {
  let text = heading(book, ch)
  const starts = []
  for (const v of verses(book, ch)) { text += ' '; starts.push(text.length); text += v }
  return { text, starts }
}

/** Most-read first, then day 1 of every plan, day 2 of every plan, and so on. */
export function scopeOrder() {
  const seen = new Set(), out = []
  const add = ([b, c], why) => { const k = `${b}-${c}`; if (!seen.has(k)) { seen.add(k); out.push({ key: k, book: b, chapter: c, why }) } }
  MOST_READ.forEach((r) => add(r, 'most-read'))
  const maxDays = Math.max(...Object.values(PLANS).map((d) => d.length))
  for (let d = 0; d < maxDays; d++) for (const [id, days] of Object.entries(PLANS)) if (days[d]) days[d].forEach((r) => add(r, `${id} day ${d + 1}`))
  return out
}

function ledger() { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')) } catch { return { chars: 0, requests: 0 } } }
function saveLedger(l) { fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n') }

async function tts(text, voice, withTimestamps) {
  const key = process.env.XAI_API_KEY
  if (!key) throw new Error('XAI_API_KEY is not set')
  const res = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text, voice_id: voice, language: 'en', speed: SPEED,
      output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 64000 },
      ...(withTimestamps ? { with_timestamps: true } : {}),
    }),
  })
  const l = ledger(); l.chars += text.length; l.requests++; saveLedger(l)
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300).replace(/xai-[A-Za-z0-9]+/g, '[redacted]')
    const err = new Error(`TTS HTTP ${res.status}: ${body}`); err.status = res.status; throw err
  }
  if (!withTimestamps) return { audio: Buffer.from(await res.arrayBuffer()) }
  const j = await res.json()
  return { audio: Buffer.from(j.audio, 'base64'), duration: j.duration, ts: j.audio_timestamps }
}

/** Start time (s) of the character at each input offset; graph_chars mirrors the input one-for-one. */
function timesAt(text, ts, offsets) {
  const chars = ts.graph_chars, times = ts.graph_times
  let map
  if (chars.length === text.length) map = (o) => times[o][0]
  else {
    // Defensive: walk non-space characters in order.
    const idx = []; let j = 0
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) { idx.push(-1); continue }
      while (j < chars.length && chars[j] !== text[i]) j++
      idx.push(j < chars.length ? j++ : -1)
    }
    map = (o) => { let k = o; while (k < idx.length && idx[k] < 0) k++; return k < idx.length ? times[idx[k]][0] : NaN }
  }
  return offsets.map((o) => Math.round(map(o) * 1000) / 1000)
}

async function recordChapter(book, ch, voice) {
  const vs = verses(book, ch)
  // Parts at verse boundaries, each under PART_MAX characters.
  const parts = []; let cur = { text: heading(book, ch), starts: [] }
  for (const v of vs) {
    if (cur.text.length + v.length + 1 > PART_MAX && cur.starts.length) { parts.push(cur); cur = { text: '', starts: [] } }
    if (cur.text) cur.text += ' '
    cur.starts.push(cur.text.length); cur.text += v
  }
  parts.push(cur)
  const tmp = fs.mkdtempSync('/tmp/grok-narr-')
  const v = []; let offset = 0; const files = []
  for (const [i, p] of parts.entries()) {
    const r = await tts(p.text, voice, true)
    const f = path.join(tmp, `p${i}.mp3`); fs.writeFileSync(f, r.audio); files.push(f)
    for (const t of timesAt(p.text, r.ts, p.starts)) v.push(Math.round((t + offset) * 1000) / 1000)
    offset += r.duration
  }
  fs.mkdirSync(OUT, { recursive: true })
  const mp3 = path.join(OUT, `${book}-${ch}.mp3`)
  if (files.length === 1) fs.copyFileSync(files[0], mp3)
  else {
    fs.writeFileSync(path.join(tmp, 'list.txt'), files.map((f) => `file '${f}'`).join('\n'))
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', mp3])
  }
  if (v.length !== vs.length || v.some((t) => !Number.isFinite(t))) throw new Error(`${book} ${ch}: verse timings incomplete`)
  fs.writeFileSync(path.join(OUT, `${book}-${ch}.json`), JSON.stringify({ voice, d: Math.round(offset * 1000) / 1000, v }) + '\n')
  fs.rmSync(tmp, { recursive: true, force: true })
}

export function writeManifest() {
  const have = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []
  const voices = new Set(have.map((k) => JSON.parse(fs.readFileSync(path.join(OUT, k + '.json'), 'utf8')).voice))
  const order = new Map(scopeOrder().map((s, i) => [s.key, i]))
  have.sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
  fs.writeFileSync(MANIFEST, JSON.stringify({ voice: [...voices].join(',') || null, chapters: have }, null, 1) + '\n')
  return have
}

const [cmd = 'scope', ...rest] = process.argv.slice(2)
const arg = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : d }
if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === 'scope') {
    const budget = Number(arg('--budget', 10))
    let total = 0, fit = 0, fitChars = 0
    const rows = scopeOrder().map((s) => { const n = chapterText(s.book, s.chapter).text.length; total += n; if ((total) * USD_PER_CHAR <= budget) { fit++; fitChars = total } return { ...s, chars: n } })
    console.log(`all plan + most-read chapters: ${rows.length}, ${total} chars, ~$${(total * USD_PER_CHAR).toFixed(2)}`)
    console.log(`fit in $${budget}: first ${fit} chapters, ${fitChars} chars, ~$${(fitChars * USD_PER_CHAR).toFixed(2)}`)
    const last = rows[fit - 1]; console.log(`last included: ${last.key} (${last.why})`)
    for (const [id, days] of Object.entries(PLANS)) {
      const inc = new Set(rows.slice(0, fit).map((r) => r.key))
      let d = 0; while (d < days.length && days[d].every(([b, c]) => inc.has(`${b}-${c}`))) d++
      console.log(`  ${id}: days 1-${d} of ${days.length} covered`)
    }
    if (rest.includes('--json')) fs.writeFileSync('/tmp/narration-scope.json', JSON.stringify(rows, null, 1))
  } else if (cmd === 'audition') {
    const dir = rest[0] || '/workspace/qa-tools'
    const text = 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
    for (const v of CANDIDATES) {
      const r = await tts(text, v, false)
      const f = path.join(dir, `bible-grok-john3-16-${v}.mp3`); fs.writeFileSync(f, r.audio); console.log('wrote', f, r.audio.length, 'bytes')
    }
  } else if (cmd === 'generate') {
    const budget = Number(arg('--budget', 10)), voice = arg('--voice', VOICE)
    for (const s of scopeOrder()) {
      if (fs.existsSync(path.join(OUT, `${s.key}.json`))) continue
      const n = chapterText(s.book, s.chapter).text.length
      if ((ledger().chars + n) * USD_PER_CHAR > budget) { console.log(`budget reached before ${s.key}`); break }
      try { await recordChapter(s.book, s.chapter, voice) } catch (e) { console.error(String(e.message || e)); writeManifest(); process.exit(1) }
      console.log(`ok ${s.key}  spent ~$${(ledger().chars * USD_PER_CHAR).toFixed(2)}`)
    }
    console.log(`${writeManifest().length} chapters recorded`)
  } else if (cmd === 'manifest') console.log(writeManifest().length, 'chapters')
}
