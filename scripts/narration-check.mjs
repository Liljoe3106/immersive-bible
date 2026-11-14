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
