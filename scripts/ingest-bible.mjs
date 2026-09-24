#!/usr/bin/env node
/**
 * Ingest KJV English (all 66), originals (prefer fuller; min Gen + John),
 * Strong's subset, search.json, catalog.json into public/data/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'data')
const EN = path.join(OUT, 'en')
const ORIG = path.join(OUT, 'orig')

const BOOKS = [
  { id: 'gen', name: 'Genesis', chapters: 50, testament: 'ot', kjv: 'Genesis', oshb: 'Gen', morph: null },
  { id: 'exo', name: 'Exodus', chapters: 40, testament: 'ot', kjv: 'Exodus', oshb: 'Exod', morph: null },
  { id: 'lev', name: 'Leviticus', chapters: 27, testament: 'ot', kjv: 'Leviticus', oshb: 'Lev', morph: null },
  { id: 'num', name: 'Numbers', chapters: 36, testament: 'ot', kjv: 'Numbers', oshb: 'Num', morph: null },
  { id: 'deu', name: 'Deuteronomy', chapters: 34, testament: 'ot', kjv: 'Deuteronomy', oshb: 'Deut', morph: null },
  { id: 'jos', name: 'Joshua', chapters: 24, testament: 'ot', kjv: 'Joshua', oshb: 'Josh', morph: null },
  { id: 'jdg', name: 'Judges', chapters: 21, testament: 'ot', kjv: 'Judges', oshb: 'Judg', morph: null },
  { id: 'rut', name: 'Ruth', chapters: 4, testament: 'ot', kjv: 'Ruth', oshb: 'Ruth', morph: null },
  { id: '1sa', name: '1 Samuel', chapters: 31, testament: 'ot', kjv: '1Samuel', oshb: '1Sam', morph: null },
  { id: '2sa', name: '2 Samuel', chapters: 24, testament: 'ot', kjv: '2Samuel', oshb: '2Sam', morph: null },
  { id: '1ki', name: '1 Kings', chapters: 22, testament: 'ot', kjv: '1Kings', oshb: '1Kgs', morph: null },
  { id: '2ki', name: '2 Kings', chapters: 25, testament: 'ot', kjv: '2Kings', oshb: '2Kgs', morph: null },
  { id: '1ch', name: '1 Chronicles', chapters: 29, testament: 'ot', kjv: '1Chronicles', oshb: '1Chr', morph: null },
  { id: '2ch', name: '2 Chronicles', chapters: 36, testament: 'ot', kjv: '2Chronicles', oshb: '2Chr', morph: null },
  { id: 'ezr', name: 'Ezra', chapters: 10, testament: 'ot', kjv: 'Ezra', oshb: 'Ezra', morph: null },
  { id: 'neh', name: 'Nehemiah', chapters: 13, testament: 'ot', kjv: 'Nehemiah', oshb: 'Neh', morph: null },
  { id: 'est', name: 'Esther', chapters: 10, testament: 'ot', kjv: 'Esther', oshb: 'Esth', morph: null },
  { id: 'job', name: 'Job', chapters: 42, testament: 'ot', kjv: 'Job', oshb: 'Job', morph: null },
  { id: 'psa', name: 'Psalms', chapters: 150, testament: 'ot', kjv: 'Psalms', oshb: 'Ps', morph: null },
  { id: 'pro', name: 'Proverbs', chapters: 31, testament: 'ot', kjv: 'Proverbs', oshb: 'Prov', morph: null },
  { id: 'ecc', name: 'Ecclesiastes', chapters: 12, testament: 'ot', kjv: 'Ecclesiastes', oshb: 'Eccl', morph: null },
  { id: 'sng', name: 'Song of Solomon', chapters: 8, testament: 'ot', kjv: 'SongofSolomon', oshb: 'Song', morph: null },
  { id: 'isa', name: 'Isaiah', chapters: 66, testament: 'ot', kjv: 'Isaiah', oshb: 'Isa', morph: null },
  { id: 'jer', name: 'Jeremiah', chapters: 52, testament: 'ot', kjv: 'Jeremiah', oshb: 'Jer', morph: null },
  { id: 'lam', name: 'Lamentations', chapters: 5, testament: 'ot', kjv: 'Lamentations', oshb: 'Lam', morph: null },
  { id: 'ezk', name: 'Ezekiel', chapters: 48, testament: 'ot', kjv: 'Ezekiel', oshb: 'Ezek', morph: null },
  { id: 'dan', name: 'Daniel', chapters: 12, testament: 'ot', kjv: 'Daniel', oshb: 'Dan', morph: null },
  { id: 'hos', name: 'Hosea', chapters: 14, testament: 'ot', kjv: 'Hosea', oshb: 'Hos', morph: null },
  { id: 'jol', name: 'Joel', chapters: 3, testament: 'ot', kjv: 'Joel', oshb: 'Joel', morph: null },
  { id: 'amo', name: 'Amos', chapters: 9, testament: 'ot', kjv: 'Amos', oshb: 'Amos', morph: null },
  { id: 'oba', name: 'Obadiah', chapters: 1, testament: 'ot', kjv: 'Obadiah', oshb: 'Obad', morph: null },
  { id: 'jon', name: 'Jonah', chapters: 4, testament: 'ot', kjv: 'Jonah', oshb: 'Jonah', morph: null },
  { id: 'mic', name: 'Micah', chapters: 7, testament: 'ot', kjv: 'Micah', oshb: 'Mic', morph: null },
  { id: 'nam', name: 'Nahum', chapters: 3, testament: 'ot', kjv: 'Nahum', oshb: 'Nah', morph: null },
  { id: 'hab', name: 'Habakkuk', chapters: 3, testament: 'ot', kjv: 'Habakkuk', oshb: 'Hab', morph: null },
  { id: 'zep', name: 'Zephaniah', chapters: 3, testament: 'ot', kjv: 'Zephaniah', oshb: 'Zeph', morph: null },
  { id: 'hag', name: 'Haggai', chapters: 2, testament: 'ot', kjv: 'Haggai', oshb: 'Hag', morph: null },
  { id: 'zec', name: 'Zechariah', chapters: 14, testament: 'ot', kjv: 'Zechariah', oshb: 'Zech', morph: null },
  { id: 'mal', name: 'Malachi', chapters: 4, testament: 'ot', kjv: 'Malachi', oshb: 'Mal', morph: null },
  { id: 'mat', name: 'Matthew', chapters: 28, testament: 'nt', kjv: 'Matthew', oshb: null, morph: '61-Mt-morphgnt.txt' },
  { id: 'mrk', name: 'Mark', chapters: 16, testament: 'nt', kjv: 'Mark', oshb: null, morph: '62-Mk-morphgnt.txt' },
  { id: 'luk', name: 'Luke', chapters: 24, testament: 'nt', kjv: 'Luke', oshb: null, morph: '63-Lk-morphgnt.txt' },
  { id: 'jhn', name: 'John', chapters: 21, testament: 'nt', kjv: 'John', oshb: null, morph: '64-Jn-morphgnt.txt' },
  { id: 'act', name: 'Acts', chapters: 28, testament: 'nt', kjv: 'Acts', oshb: null, morph: '65-Ac-morphgnt.txt' },
  { id: 'rom', name: 'Romans', chapters: 16, testament: 'nt', kjv: 'Romans', oshb: null, morph: '66-Ro-morphgnt.txt' },
  { id: '1co', name: '1 Corinthians', chapters: 16, testament: 'nt', kjv: '1Corinthians', oshb: null, morph: '67-1Co-morphgnt.txt' },
  { id: '2co', name: '2 Corinthians', chapters: 13, testament: 'nt', kjv: '2Corinthians', oshb: null, morph: '68-2Co-morphgnt.txt' },
  { id: 'gal', name: 'Galatians', chapters: 6, testament: 'nt', kjv: 'Galatians', oshb: null, morph: '69-Ga-morphgnt.txt' },
  { id: 'eph', name: 'Ephesians', chapters: 6, testament: 'nt', kjv: 'Ephesians', oshb: null, morph: '70-Eph-morphgnt.txt' },
  { id: 'php', name: 'Philippians', chapters: 4, testament: 'nt', kjv: 'Philippians', oshb: null, morph: '71-Php-morphgnt.txt' },
  { id: 'col', name: 'Colossians', chapters: 4, testament: 'nt', kjv: 'Colossians', oshb: null, morph: '72-Col-morphgnt.txt' },
  { id: '1th', name: '1 Thessalonians', chapters: 5, testament: 'nt', kjv: '1Thessalonians', oshb: null, morph: '73-1Th-morphgnt.txt' },
  { id: '2th', name: '2 Thessalonians', chapters: 3, testament: 'nt', kjv: '2Thessalonians', oshb: null, morph: '74-2Th-morphgnt.txt' },
  { id: '1ti', name: '1 Timothy', chapters: 6, testament: 'nt', kjv: '1Timothy', oshb: null, morph: '75-1Ti-morphgnt.txt' },
  { id: '2ti', name: '2 Timothy', chapters: 4, testament: 'nt', kjv: '2Timothy', oshb: null, morph: '76-2Ti-morphgnt.txt' },
  { id: 'tit', name: 'Titus', chapters: 3, testament: 'nt', kjv: 'Titus', oshb: null, morph: '77-Tit-morphgnt.txt' },
  { id: 'phm', name: 'Philemon', chapters: 1, testament: 'nt', kjv: 'Philemon', oshb: null, morph: '78-Phm-morphgnt.txt' },
  { id: 'heb', name: 'Hebrews', chapters: 13, testament: 'nt', kjv: 'Hebrews', oshb: null, morph: '79-Heb-morphgnt.txt' },
  { id: 'jas', name: 'James', chapters: 5, testament: 'nt', kjv: 'James', oshb: null, morph: '80-Jas-morphgnt.txt' },
  { id: '1pe', name: '1 Peter', chapters: 5, testament: 'nt', kjv: '1Peter', oshb: null, morph: '81-1Pe-morphgnt.txt' },
  { id: '2pe', name: '2 Peter', chapters: 3, testament: 'nt', kjv: '2Peter', oshb: null, morph: '82-2Pe-morphgnt.txt' },
  { id: '1jn', name: '1 John', chapters: 5, testament: 'nt', kjv: '1John', oshb: null, morph: '83-1Jn-morphgnt.txt' },
  { id: '2jn', name: '2 John', chapters: 1, testament: 'nt', kjv: '2John', oshb: null, morph: '84-2Jn-morphgnt.txt' },
  { id: '3jn', name: '3 John', chapters: 1, testament: 'nt', kjv: '3John', oshb: null, morph: '85-3Jn-morphgnt.txt' },
  { id: 'jud', name: 'Jude', chapters: 1, testament: 'nt', kjv: 'Jude', oshb: null, morph: '86-Jud-morphgnt.txt' },
  { id: 'rev', name: 'Revelation', chapters: 22, testament: 'nt', kjv: 'Revelation', oshb: null, morph: '87-Re-morphgnt.txt' },
]

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return await res.text()
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url))
}

function cleanKjv(text) {
  // Remove {supplied} italic markers and leftover braces
  return text
    .replace(/\{([^}]*)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

async function ingestEnglish() {
  ensureDir(EN)
  const search = []
  const catalog = []
  console.log('Ingesting KJV English...')
  for (const book of BOOKS) {
    const url = `https://cdn.jsdelivr.net/gh/aruljohn/Bible-kjv@master/${encodeURIComponent(book.kjv)}.json`
    let data
    try {
      data = await fetchJson(url)
    } catch (e) {
      console.warn('Retry raw github for', book.kjv)
      data = await fetchJson(`https://raw.githubusercontent.com/aruljohn/Bible-kjv/master/${encodeURIComponent(book.kjv)}.json`)
    }
    const chapters = []
    for (const ch of data.chapters) {
      const verses = ch.verses.map((v) => cleanKjv(v.text))
      chapters.push(verses)
      verses.forEach((text, i) => {
        search.push([book.id, Number(ch.chapter), i + 1, text])
      })
    }
    fs.writeFileSync(path.join(EN, `${book.id}.json`), JSON.stringify(chapters))
    catalog.push({ id: book.id, name: book.name, chapters: chapters.length, testament: book.testament })
    console.log(`  en/${book.id}.json (${chapters.length} ch)`)
  }
  fs.writeFileSync(path.join(OUT, 'search.json'), JSON.stringify(search))
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify({ books: catalog, version: 'kjv', generated: new Date().toISOString() }))
  console.log(`search.json: ${search.length} verses`)
  return search.length
}

function parseMorphLine(line) {
  // bookchverse POS parse text lemma? — MorphGNT format:
  // 010101 N- ----NSF- Βίβλος Βίβλος βίβλος βίβλος
  const parts = line.trim().split(/\s+/)
  if (parts.length < 7) return null
  const ref = parts[0]
  const book = parseInt(ref.slice(0, 2), 10)
  const chapter = parseInt(ref.slice(2, 4), 10)
  const verse = parseInt(ref.slice(4, 6), 10)
  const pos = parts[1]
  const parse = parts[2]
  const word = parts[3]
  const lemma = parts[6] || parts[5] || word
  // Strong's not in MorphGNT directly — leave s empty or derive later
  return { book, chapter, verse, t: word, m: `${pos} ${parse}`.trim(), l: lemma, s: '' }
}

async function ingestGreek(bookIds) {
  ensureDir(ORIG)
  const want = new Set(bookIds)
  for (const book of BOOKS) {
    if (!book.morph || !want.has(book.id)) continue
    const url = `https://cdn.jsdelivr.net/gh/morphgnt/sblgnt@master/${book.morph}`
    console.log(`Ingesting Greek ${book.id}...`)
    let text
    try {
      text = await fetchText(url)
    } catch {
      text = await fetchText(`https://raw.githubusercontent.com/morphgnt/sblgnt/master/${book.morph}`)
    }
    const chapters = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      const w = parseMorphLine(line)
      if (!w) continue
      while (chapters.length < w.chapter) chapters.push([])
      const ch = chapters[w.chapter - 1]
      while (ch.length < w.verse) ch.push([])
      ch[w.verse - 1].push({ t: w.t, s: w.s, m: w.m, l: w.l })
    }
    fs.writeFileSync(path.join(ORIG, `${book.id}.json`), JSON.stringify(chapters))
    console.log(`  orig/${book.id}.json (${chapters.length} ch)`)
  }
}

function stripCantillation(s) {
  // Remove Hebrew cantillation + some points keep consonants+vowels roughly; keep letters
  return s.replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3\u05C6]/g, '')
}

async function ingestHebrew(bookIds) {
  ensureDir(ORIG)
  const want = new Set(bookIds)
  for (const book of BOOKS) {
    if (!book.oshb || !want.has(book.id)) continue
    // Try multiple filename variants used by morphhb
    const candidates = [
      book.oshb,
      book.oshb.replace(/^1/, '1').replace(/^2/, '2'),
    ]
    // Known morphhb filenames
    const map = {
      Gen: 'Gen', Exod: 'Exod', Lev: 'Lev', Num: 'Num', Deut: 'Deut',
      Josh: 'Josh', Judg: 'Judg', Ruth: 'Ruth', '1Sam': '1Sam', '2Sam': '2Sam',
      '1Kgs': '1Kgs', '2Kgs': '2Kgs', '1Chr': '1Chr', '2Chr': '2Chr',
      Ezra: 'Ezra', Neh: 'Neh', Esth: 'Esth', Job: 'Job', Ps: 'Ps',
      Prov: 'Prov', Eccl: 'Eccl', Song: 'Song', Isa: 'Isa', Jer: 'Jer',
      Lam: 'Lam', Ezek: 'Ezek', Dan: 'Dan', Hos: 'Hos', Joel: 'Joel',
      Amos: 'Amos', Obad: 'Obad', Jonah: 'Jonah', Mic: 'Mic', Nah: 'Nah',
      Hab: 'Hab', Zeph: 'Zeph', Hag: 'Hag', Zech: 'Zech', Mal: 'Mal',
    }
    const file = map[book.oshb] || book.oshb
    console.log(`Ingesting Hebrew ${book.id} (${file})...`)
    let xml
    try {
      xml = await fetchText(`https://cdn.jsdelivr.net/gh/openscriptures/morphhb@master/wlc/${file}.xml`)
    } catch {
      try {
        xml = await fetchText(`https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/${file}.xml`)
      } catch (e) {
        console.warn(`  skip ${book.id}:`, e.message)
        continue
      }
    }
    // Parse verses: <verse osisID="Gen.1.1"> ... <w lemma="strong:H7225" morph="...">בְּרֵאשִׁית</w>
    const chapters = []
    const verseRe = /<verse[^>]*osisID="[^"]+\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g
    let m
    while ((m = verseRe.exec(xml))) {
      const chNum = Number(m[1])
      const vNum = Number(m[2])
      const body = m[3]
      const words = []
      const wRe = /<w\b([^>]*)>([^<]*)<\/w>/g
      let wm
      while ((wm = wRe.exec(body))) {
        const attrs = wm[1]
        const text = stripCantillation(wm[2].replace(/\//g, '')).trim()
        if (!text) continue
        const lemmaM = attrs.match(/lemma="([^"]*)"/)
        const morphM = attrs.match(/morph="([^"]*)"/)
        let strong = ''
        let lemma = ''
        if (lemmaM) {
          lemma = lemmaM[1]
          const sm = lemma.match(/strong:([HG]\d+)/i)
          if (sm) strong = sm[1].toUpperCase()
          else {
            const nums = [...lemma.matchAll(/(\d+)/g)].map((x) => x[1])
            if (nums.length) strong = 'H' + nums[nums.length - 1]
          }
        }
        words.push({
          t: text,
          s: strong,
          m: morphM ? morphM[1] : '',
          l: lemma || undefined,
        })
      }
      while (chapters.length < chNum) chapters.push([])
      const ch = chapters[chNum - 1]
      while (ch.length < vNum) ch.push([])
      ch[vNum - 1] = words
    }
    if (chapters.length === 0) {
      console.warn(`  no verses parsed for ${book.id}`)
      continue
    }
    fs.writeFileSync(path.join(ORIG, `${book.id}.json`), JSON.stringify(chapters))
    console.log(`  orig/${book.id}.json (${chapters.length} ch)`)
  }
}

function jsObjectToJson(jsText) {
  // Files are like: var strongsHebrewDictionary = { ... };
  const start = jsText.indexOf('{')
  const end = jsText.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No object found')
  // Use Function to evaluate object literal safely-ish (local trusted source)
  const body = jsText.slice(start, end + 1)
  // eslint-disable-next-line no-new-func
  return new Function(`return (${body})`)()
}

async function ingestStrongs() {
  console.log('Ingesting Strong\'s...')
  const hJs = await fetchText('https://cdn.jsdelivr.net/gh/openscriptures/strongs@master/hebrew/strongs-hebrew-dictionary.js')
  const gJs = await fetchText('https://cdn.jsdelivr.net/gh/openscriptures/strongs@master/greek/strongs-greek-dictionary.js')
  const hebrew = jsObjectToJson(hJs)
  const greek = jsObjectToJson(gJs)
  const out = {}
  // Collect Strong's numbers used in orig files we have
  const used = new Set()
  if (fs.existsSync(ORIG)) {
    for (const f of fs.readdirSync(ORIG)) {
      if (!f.endsWith('.json')) continue
      const data = JSON.parse(fs.readFileSync(path.join(ORIG, f), 'utf8'))
      for (const ch of data) {
        for (const v of ch) {
          for (const w of v) {
            if (w.s) used.add(w.s.toUpperCase())
          }
        }
      }
    }
  }
  // Always include a usable core subset + any used
  const CORE = [
    'H7225','H430','H1254','H8064','H776','H1961','H2822','H7307','H5921','H6440',
    'H3068','H559','H0853','H3605','H3117','H1004','H1121','H376','H802','H7760',
    'G2316','G3056','G746','G2250','G3962','G5207','G4100','G26','G4151','G5547',
    'G2424','G2962','G444','G2889','G4561','G3340','G86','G1577','G3056','G5046',
    'G391','G5590','G2222','G228','G225','G5485','G4102','G1680','G26','G25',
  ]
  for (const s of CORE) used.add(s)

  function addEntry(key, entry) {
    if (!entry) return
    out[key] = {
      lemma: entry.lemma || entry.xlit || '',
      xlit: entry.xlit || '',
      strongs_def: entry.strongs_def || entry.kjv_def || '',
      kjv_def: entry.kjv_def || '',
      der: entry.derivation || '',
    }
  }

  // Prefer used + sample of full dictionaries for browseability (cap size)
  let added = 0
  for (const [k, v] of Object.entries(hebrew)) {
    const key = k.toUpperCase().startsWith('H') ? k.toUpperCase() : `H${k}`
    if (used.has(key) || used.has(k.toUpperCase()) || added < 2500) {
      addEntry(key.startsWith('H') ? key : `H${k}`, v)
      added++
    }
  }
  added = 0
  for (const [k, v] of Object.entries(greek)) {
    const key = k.toUpperCase().startsWith('G') ? k.toUpperCase() : `G${k}`
    if (used.has(key) || used.has(k.toUpperCase()) || added < 2500) {
      addEntry(key.startsWith('G') ? key : `G${k}`, v)
      added++
    }
  }
  // Ensure used ones present
  for (const s of used) {
    if (out[s]) continue
    const num = s.slice(1)
    if (s.startsWith('H') && hebrew[num]) addEntry(s, hebrew[num])
    if (s.startsWith('G') && greek[num]) addEntry(s, greek[num])
    // sometimes keys already include H/G
    if (hebrew[s]) addEntry(s, hebrew[s])
    if (greek[s]) addEntry(s, greek[s])
  }

  fs.writeFileSync(path.join(OUT, 'strongs.json'), JSON.stringify(out))
  console.log(`strongs.json: ${Object.keys(out).length} entries`)
}

async function main() {
  ensureDir(EN)
  ensureDir(ORIG)
  await ingestEnglish()
  // Prefer fuller originals: all OT Hebrew if feasible + all NT Greek; min Gen + John
  const otIds = BOOKS.filter((b) => b.testament === 'ot').map((b) => b.id)
  const ntIds = BOOKS.filter((b) => b.testament === 'nt').map((b) => b.id)
  // Full OT may be large; do all OT + all NT for quality
  await ingestHebrew(otIds)
  await ingestGreek(ntIds)
  await ingestStrongs()
  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
