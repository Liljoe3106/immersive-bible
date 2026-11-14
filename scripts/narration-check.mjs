// Read-aloud helper checks: node scripts/narration-check.mjs (npm run qa:narration)
import assert from 'node:assert'
import fs from 'node:fs'
import { pickVoice, scoreVoice, chunkVerse, NARRATION_RATE, NARRATION_DUCK } from '../src/lib/narration.ts'

const vs = [
  { name: 'Albert', lang: 'en-US' },
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Daniel', lang: 'en-GB', localService: true },
  { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB' },
  { name: 'Xander', lang: 'nl-NL' },
]
assert.match(pickVoice(vs).name, /Sonia/, 'natural voice wins')
assert.equal(pickVoice(vs.slice(0, 3)).name, 'Daniel', 'UK English preferred over US')
assert.equal(pickVoice([{ name: 'Albert', lang: 'en-US' }, { name: 'Amelie', lang: 'fr-FR' }]), null, 'never a novelty or non-English voice')
assert.equal(pickVoice([]), null)
assert.equal(scoreVoice({ name: 'Samantha', lang: 'en_US' }) > 0, true, 'underscore locales accepted')
assert.ok(NARRATION_RATE < 1 && NARRATION_RATE >= 0.75, 'slowish rate')
assert.ok(NARRATION_DUCK > 0 && NARRATION_DUCK < 1, 'ambient dips a little, not to silence')

let verses = 0
for (const f of fs.readdirSync('public/data/en')) {
  for (const ch of JSON.parse(fs.readFileSync('public/data/en/' + f, 'utf8'))) {
    for (const v of ch) {
      verses++
      const parts = chunkVerse(v)
      for (const p of parts) assert.ok(p.length <= 220, `${f}: chunk too long`)
      assert.equal(parts.join(' '), v.replace(/\s+/g, ' ').trim(), `${f}: chunks rebuild the verse`)
    }
  }
}
console.log(`narration-check: ok (${verses} verses chunk cleanly)`)

// Grok recordings: verse lookup, and every chapter in the manifest has its MP3 and a full timing file.
const { verseAt } = await import('../src/lib/narration.ts')
assert.equal(verseAt([0, 2.5, 6], 0), 1)
assert.equal(verseAt([0.8, 2.5, 6], 0.1), 1, 'before verse 1 starts')
assert.equal(verseAt([0, 2.5, 6], 2.5), 2)
assert.equal(verseAt([0, 2.5, 6], 5.99), 2)
assert.equal(verseAt([0, 2.5, 6], 99), 3)
const manifest = JSON.parse(fs.readFileSync('src/lib/narration-audio.json', 'utf8'))
for (const key of manifest.chapters) {
  const [book, ch] = [key.slice(0, key.lastIndexOf('-')), Number(key.slice(key.lastIndexOf('-') + 1))]
  assert.ok(fs.existsSync(`public/narration/grok/${key}.mp3`), `${key}: mp3 missing`)
  const t = JSON.parse(fs.readFileSync(`public/narration/grok/${key}.json`, 'utf8'))
  const n = JSON.parse(fs.readFileSync(`public/data/en/${book}.json`, 'utf8'))[ch - 1].length
  assert.equal(t.v.length, n, `${key}: one start time per verse`)
  for (let i = 1; i < t.v.length; i++) assert.ok(t.v[i] >= t.v[i - 1], `${key}: times ascend`)
  assert.ok(t.v.at(-1) < t.d, `${key}: last verse starts before the end`)
}
console.log(`narration-check: ok (${manifest.chapters.length} Grok-recorded chapters)`)
