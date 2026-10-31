import { parseReference } from './bible/parse-ref'
import { loadSearchIndex } from './bible/load'
import type { SearchHit } from './bible/types'
import { formatRef } from './bible/books'

export interface SituationMatch {
  ref: string
  book: string
  chapter: number
  verse: number
  text: string
  thenSense?: string
}

export interface Situation {
  id: string
  label: string
  keywords: string[]
  matches: { book: string; chapter: number; verse: number; thenSense?: string }[]
}

export const SITUATIONS: Situation[] = [
  {
    id: 'grief',
    label: 'Grief',
    keywords: ['grief', 'mourning', 'bereaved', 'lost someone', 'death of', 'weeping'],
    matches: [
      { book: 'psa', chapter: 34, verse: 18, thenSense: 'Nearness in brokenness, not distance.' },
      { book: 'mat', chapter: 5, verse: 4, thenSense: 'Comfort promised to mourners.' },
      { book: 'jhn', chapter: 11, verse: 35, thenSense: 'Jesus weeps: divine nearness in loss.' },
      { book: 'rev', chapter: 21, verse: 4, thenSense: 'Tears wiped; death undone.' },
    ],
  },
  {
    id: 'fear',
    label: 'Fear',
    keywords: ['fear', 'afraid', 'anxious', 'anxiety', 'worried', 'terror'],
    matches: [
      { book: 'isa', chapter: 41, verse: 10, thenSense: 'Fear not: presence, not bravado.' },
      { book: 'psa', chapter: 23, verse: 4, thenSense: 'Valley walk with a shepherd.' },
      { book: 'php', chapter: 4, verse: 6, thenSense: 'Anxiety met with petition.' },
      { book: '2ti', chapter: 1, verse: 7, thenSense: 'Spirit of power, love, sound mind.' },
    ],
  },
  {
    id: 'gratitude',
    label: 'Gratitude',
    keywords: ['gratitude', 'thankful', 'thanks', 'grateful', 'praise'],
    matches: [
      { book: 'psa', chapter: 100, verse: 4, thenSense: 'Enter with thanksgiving.' },
      { book: '1th', chapter: 5, verse: 18, thenSense: 'Give thanks in all (not for all as glib).' },
      { book: 'psa', chapter: 103, verse: 2, thenSense: 'Forget not His benefits.' },
      { book: 'col', chapter: 3, verse: 15, thenSense: 'Thankfulness as peace’s companion.' },
    ],
  },
  {
    id: 'temptation',
    label: 'Temptation',
    keywords: ['temptation', 'tempted', 'lust', 'desire', 'addiction', 'urge'],
    matches: [
      { book: '1co', chapter: 10, verse: 13, thenSense: 'Way of escape: fidelity of God.' },
      { book: 'jas', chapter: 1, verse: 14, thenSense: 'Desire conceives: own lure.' },
      { book: 'mat', chapter: 26, verse: 41, thenSense: 'Watch and pray; flesh is weak.' },
      { book: 'heb', chapter: 4, verse: 15, thenSense: 'High priest who was tempted.' },
    ],
  },
  {
    id: 'insomnia',
    label: 'Insomnia',
    keywords: ['insomnia', "can't sleep", 'cannot sleep', 'sleepless', 'night watch', 'restless'],
    matches: [
      { book: 'psa', chapter: 4, verse: 8, thenSense: 'Lie down in peace: safety.' },
      { book: 'psa', chapter: 63, verse: 6, thenSense: 'Night watches become meditation.' },
      { book: 'psa', chapter: 127, verse: 2, thenSense: 'He gives sleep to His beloved.' },
      { book: 'mat', chapter: 11, verse: 28, thenSense: 'Rest for the heavy-laden.' },
    ],
  },
  {
    id: 'anger',
    label: 'Anger',
    keywords: ['anger', 'angry', 'rage', 'wrath', 'furious', 'resentment'],
    matches: [
      { book: 'eph', chapter: 4, verse: 26, thenSense: 'Be angry and sin not: sundown limit.' },
      { book: 'jas', chapter: 1, verse: 19, thenSense: 'Slow to wrath.' },
      { book: 'pro', chapter: 15, verse: 1, thenSense: 'Soft answer turns away wrath.' },
      { book: 'psa', chapter: 37, verse: 8, thenSense: 'Cease from anger; forsake wrath.' },
    ],
  },
  {
    id: 'loneliness',
    label: 'Loneliness',
    keywords: ['lonely', 'loneliness', 'alone', 'abandoned', 'forsaken', 'isolated'],
    matches: [
      { book: 'deu', chapter: 31, verse: 6, thenSense: 'He will not fail nor forsake.' },
      { book: 'psa', chapter: 27, verse: 10, thenSense: 'When family fails, the LORD takes up.' },
      { book: 'isa', chapter: 43, verse: 2, thenSense: 'With you in waters and fire.' },
      { book: 'mat', chapter: 28, verse: 20, thenSense: 'I am with you always.' },
    ],
  },
  {
    id: 'shame',
    label: 'Shame',
    keywords: ['shame', 'ashamed', 'guilt', 'disgrace', 'unworthy'],
    matches: [
      { book: 'rom', chapter: 8, verse: 1, thenSense: 'No condemnation in Christ.' },
      { book: 'psa', chapter: 34, verse: 5, thenSense: 'Faces not ashamed: radiant.' },
      { book: 'isa', chapter: 54, verse: 4, thenSense: 'Fear not; you shall not be ashamed.' },
      { book: '1jn', chapter: 1, verse: 9, thenSense: 'Confess: cleanse from unrighteousness.' },
    ],
  },
  {
    id: 'hope',
    label: 'Hope',
    keywords: ['hope', 'hoping', 'despair', 'future', 'wait'],
    matches: [
      { book: 'rom', chapter: 15, verse: 13, thenSense: 'God of hope fills with joy and peace.' },
      { book: 'jer', chapter: 29, verse: 11, thenSense: 'Thoughts of peace: expected end.' },
      { book: 'lam', chapter: 3, verse: 21, thenSense: 'I recall; therefore hope.' },
      { book: 'heb', chapter: 6, verse: 19, thenSense: 'Anchor of the soul.' },
    ],
  },
  {
    id: 'doubt',
    label: 'Doubt',
    keywords: ['doubt', 'doubting', 'unbelief', 'skeptical', 'unsure', 'faith crisis'],
    matches: [
      { book: 'mrk', chapter: 9, verse: 24, thenSense: 'I believe; help my unbelief.' },
      { book: 'jhn', chapter: 20, verse: 27, thenSense: 'Thomas invited to touch.' },
      { book: 'jas', chapter: 1, verse: 6, thenSense: 'Ask in faith: wave warning.' },
      { book: 'jud', chapter: 1, verse: 22, thenSense: 'Have compassion on some, making a difference.' },
    ],
  },
  {
    id: 'joy',
    label: 'Joy',
    keywords: ['joy', 'joyful', 'rejoice', 'glad', 'delight', 'happiness'],
    matches: [
      { book: 'psa', chapter: 16, verse: 11, thenSense: 'Fullness of joy in His presence.' },
      { book: 'php', chapter: 4, verse: 4, thenSense: 'Rejoice in the Lord always.' },
      { book: 'jhn', chapter: 15, verse: 11, thenSense: 'Joy made full in His words.' },
      { book: 'neh', chapter: 8, verse: 10, thenSense: 'Joy of the LORD is strength.' },
    ],
  },
  {
    id: 'exhaustion',
    label: 'Exhaustion',
    keywords: ['exhaustion', 'exhausted', 'tired', 'weary', 'burned out', 'burnout', 'fatigue'],
    matches: [
      { book: 'isa', chapter: 40, verse: 31, thenSense: 'Wait on the LORD; renew strength.' },
      { book: 'mat', chapter: 11, verse: 28, thenSense: 'Come unto me, all ye that labour.' },
      { book: 'psa', chapter: 73, verse: 26, thenSense: 'Flesh and heart fail; God is strength.' },
      { book: 'gal', chapter: 6, verse: 9, thenSense: 'Be not weary in well doing.' },
    ],
  },
  {
    id: 'waiting',
    label: 'Waiting',
    keywords: ['waiting', 'wait', 'delay', 'patience', 'how long', 'deferred'],
    matches: [
      { book: 'psa', chapter: 27, verse: 14, thenSense: 'Wait on the LORD; be of good courage.' },
      { book: 'isa', chapter: 40, verse: 31, thenSense: 'They that wait shall renew strength.' },
      { book: 'hab', chapter: 2, verse: 3, thenSense: 'The vision waits; it will not tarry.' },
      { book: 'rom', chapter: 8, verse: 25, thenSense: 'If we hope, then we wait with patience.' },
    ],
  },
  {
    id: 'injustice',
    label: 'Injustice',
    keywords: ['injustice', 'oppression', 'oppressed', 'unfair', 'wronged', 'justice'],
    matches: [
      { book: 'psa', chapter: 82, verse: 3, thenSense: 'Defend the poor and fatherless.' },
      { book: 'isa', chapter: 1, verse: 17, thenSense: 'Seek judgment; relieve the oppressed.' },
      { book: 'mic', chapter: 6, verse: 8, thenSense: 'Do justly, love mercy, walk humbly.' },
      { book: 'luk', chapter: 4, verse: 18, thenSense: 'Liberty to the captives.' },
    ],
  },
  {
    id: 'money',
    label: 'Money worry',
    keywords: ['money', 'finances', 'financial', 'debt', 'poor', 'poverty', 'bills', 'provision'],
    matches: [
      { book: 'mat', chapter: 6, verse: 31, thenSense: 'Take no thought: what shall we eat?' },
      { book: 'php', chapter: 4, verse: 19, thenSense: 'My God shall supply all your need.' },
      { book: 'pro', chapter: 3, verse: 9, thenSense: 'Honour the LORD with thy substance.' },
      { book: '1ti', chapter: 6, verse: 10, thenSense: 'Love of money is the root of evil.' },
    ],
  },
  {
    id: 'illness',
    label: 'Illness',
    keywords: ['illness', 'sick', 'sickness', 'disease', 'pain', 'healing', 'health'],
    matches: [
      { book: 'psa', chapter: 41, verse: 3, thenSense: 'The LORD will strengthen upon the bed of languishing.' },
      { book: 'jas', chapter: 5, verse: 14, thenSense: 'Call for the elders; anoint and pray.' },
      { book: 'mat', chapter: 9, verse: 12, thenSense: 'They that be whole need not a physician.' },
      { book: '2co', chapter: 12, verse: 9, thenSense: 'My grace is sufficient; strength in weakness.' },
    ],
  },
  {
    id: 'forgiveness',
    label: 'Forgiveness',
    keywords: ['forgiveness', 'forgive', 'forgiving', 'bitterness', 'revenge', 'reconcile'],
    matches: [
      { book: 'mat', chapter: 6, verse: 14, thenSense: 'If ye forgive, your Father will forgive.' },
      { book: 'eph', chapter: 4, verse: 32, thenSense: 'Forgiving one another, as God in Christ.' },
      { book: 'col', chapter: 3, verse: 13, thenSense: 'Forbearing and forgiving one another.' },
      { book: 'psa', chapter: 103, verse: 12, thenSense: 'As far as east from west, so far removed.' },
    ],
  },
  {
    id: 'decision',
    label: 'Decision',
    keywords: ['decision', 'decide', 'choice', 'guidance', 'direction', 'crossroads', 'wisdom'],
    matches: [
      { book: 'pro', chapter: 3, verse: 5, thenSense: 'Trust in the LORD; lean not on thine own.' },
      { book: 'jas', chapter: 1, verse: 5, thenSense: 'If any lack wisdom, ask of God.' },
      { book: 'psa', chapter: 32, verse: 8, thenSense: 'I will instruct thee and teach thee.' },
      { book: 'isa', chapter: 30, verse: 21, thenSense: 'This is the way, walk ye in it.' },
    ],
  },
  {
    id: 'envy',
    label: 'Envy',
    keywords: ['envy', 'jealous', 'jealousy', 'covet', 'comparison', 'resent'],
    matches: [
      { book: 'pro', chapter: 14, verse: 30, thenSense: 'Envy is the rottenness of the bones.' },
      { book: 'gal', chapter: 5, verse: 26, thenSense: 'Not desirous of vain glory, envying.' },
      { book: 'jas', chapter: 3, verse: 16, thenSense: 'Envying and strife: confusion and evil.' },
      { book: 'psa', chapter: 37, verse: 1, thenSense: 'Fret not thyself because of evildoers.' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    keywords: ['work', 'job', 'career', 'labor', 'vocation', 'workplace', 'boss'],
    matches: [
      { book: 'col', chapter: 3, verse: 23, thenSense: 'Whatsoever ye do, do it heartily.' },
      { book: 'pro', chapter: 16, verse: 3, thenSense: 'Commit thy works unto the LORD.' },
      { book: 'ecc', chapter: 9, verse: 10, thenSense: 'Whatsoever thy hand findeth, do it.' },
      { book: '1th', chapter: 4, verse: 11, thenSense: 'Study to be quiet, and to work.' },
    ],
  },
  {
    id: 'parenting',
    label: 'Parenting',
    keywords: ['parenting', 'parent', 'family', 'children', 'child', 'kids', 'mother', 'father'],
    matches: [
      { book: 'pro', chapter: 22, verse: 6, thenSense: 'Train up a child in the way.' },
      { book: 'deu', chapter: 6, verse: 7, thenSense: 'Teach them diligently unto thy children.' },
      { book: 'eph', chapter: 6, verse: 4, thenSense: 'Bring them up in nurture of the Lord.' },
      { book: 'psa', chapter: 127, verse: 3, thenSense: 'Children are an heritage of the LORD.' },
    ],
  },
  {
    id: 'homesick',
    label: 'Homesick',
    keywords: ['homesick', 'exile', 'home', 'far from home', 'stranger', 'pilgrim', 'displaced'],
    matches: [
      { book: 'psa', chapter: 137, verse: 1, thenSense: 'By the rivers of Babylon we wept.' },
      { book: 'heb', chapter: 11, verse: 13, thenSense: 'Strangers and pilgrims on the earth.' },
      { book: 'jer', chapter: 29, verse: 7, thenSense: 'Seek the peace of the city of exile.' },
      { book: '2co', chapter: 5, verse: 1, thenSense: 'An house not made with hands, eternal.' },
    ],
  },
  {
    id: 'betrayal',
    label: 'Betrayal',
    keywords: ['betrayal', 'betrayed', 'backstab', 'treachery', 'trusted friend', 'let down'],
    matches: [
      { book: 'psa', chapter: 55, verse: 12, thenSense: 'It was not an enemy; it was a friend.' },
      { book: 'mat', chapter: 26, verse: 50, thenSense: 'Friend, wherefore art thou come?' },
      { book: 'rom', chapter: 12, verse: 19, thenSense: 'Avenge not yourselves; give place.' },
      { book: '1pe', chapter: 2, verse: 23, thenSense: 'When he suffered, he threatened not.' },
    ],
  },
  {
    id: 'peace',
    label: 'Peace',
    keywords: ['peace', 'calm', 'rest', 'stillness', 'quiet', 'shalom'],
    matches: [
      { book: 'jhn', chapter: 14, verse: 27, thenSense: 'Peace I leave with you; my peace.' },
      { book: 'php', chapter: 4, verse: 7, thenSense: 'Peace of God, which passeth understanding.' },
      { book: 'isa', chapter: 26, verse: 3, thenSense: 'Perfect peace: mind stayed on thee.' },
      { book: 'psa', chapter: 29, verse: 11, thenSense: 'The LORD will bless his people with peace.' },
    ],
  },
]

const CIRC_HINT =
  /\b(i feel|i'm|im |feeling|when i|struggling with|help with|dealing with|about my)\b/i

/** Everyday worry words mapped to the topic chips. Whole words only. */
const WORRY_WORDS: Record<string, string[]> = {
  illness: [
    'hospital', 'surgery', 'operation', 'cancer', 'diagnosis', 'diagnosed', 'doctor', 'doctors',
    'chemo', 'scan', 'ill', 'unwell', 'injury', 'injured', 'treatment', 'test results', 'ward',
    'hurt', 'hurting', 'heal', 'medical',
  ],
  fear: [
    'scared', 'panic', 'panicking', 'nervous', 'worry', 'worrying', 'stress', 'stressed', 'dread',
    'terrified', 'frightened', 'uneasy', 'overthinking', 'exam', 'exams',
  ],
  grief: [
    'died', 'dying', 'funeral', 'passed away', 'widow', 'widowed', 'heartbroken', 'loss', 'lost my',
    'miscarriage', 'bereavement', 'sad', 'sadness', 'crying',
  ],
  betrayal: ['divorce', 'breakup', 'broke up', 'cheated', 'affair', 'lied to me', 'used me'],
  loneliness: ['no friends', 'nobody', 'on my own', 'left out', 'rejected', 'single'],
  money: [
    'rent', 'mortgage', 'redundant', 'redundancy', 'laid off', 'unemployed', 'broke', 'cost of living',
    'loan', 'salary',
  ],
  work: ['fired', 'interview', 'colleague', 'colleagues', 'manager', 'office', 'promotion', 'deadline'],
  parenting: ['baby', 'son', 'daughter', 'teenager', 'toddler', 'pregnant', 'my kids', 'mum', 'mom', 'dad'],
  insomnia: ['awake', 'up all night', 'nightmares', 'sleep'],
  exhaustion: ['overwhelmed', 'drained', 'worn out', 'no energy', 'stretched'],
  shame: ['guilty', 'regret', 'embarrassed', 'failure', 'failed', 'messed up'],
  anger: ['annoyed', 'frustrated', 'irritated', 'mad', 'hate'],
  hope: ['depressed', 'depression', 'hopeless', 'low', 'down', 'pointless', 'give up'],
  doubt: ['confused', 'questioning', 'is god real', 'faith'],
  decision: ['choose', 'choosing', 'options', 'move house', 'moving', 'what to do', 'which way'],
  envy: ['compare', 'comparing', 'unfair that'],
  homesick: ['miss home', 'moved away', 'new city', 'abroad'],
  peace: ['relax', 'silence', 'settle'],
  gratitude: ['blessed', 'thank you'],
  joy: ['happy', 'celebrate', 'celebrating', 'good news'],
  waiting: ['patient', 'not yet', 'still waiting'],
  injustice: ['bullied', 'bully', 'racism', 'discrimination', 'cheated out'],
  forgiveness: ['sorry', 'apologise', 'apologize', 'grudge'],
  temptation: ['drinking', 'gambling', 'porn', 'relapse', 'craving'],
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word (or whole-phrase) match, allowing simple endings like -s, -ed, -ing. */
export function hasWord(text: string, word: string): boolean {
  const w = word.trim().toLowerCase()
  if (!w) return false
  const re = new RegExp(`(^|[^a-z'])${escapeRe(w)}(s|es|d|ed|ing)?($|[^a-z'])`, 'i')
  return re.test(text)
}

function normal(q: string) {
  return q
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** Score every topic against the words typed. Highest first, zero scores dropped. */
export function scoreSituations(q: string): { situation: Situation; score: number }[] {
  const lower = normal(q)
  if (!lower) return []
  const out: { situation: Situation; score: number }[] = []
  for (const s of SITUATIONS) {
    let score = 0
    if (s.id === lower || s.label.toLowerCase() === lower) score += 100
    for (const k of s.keywords) if (hasWord(lower, k)) score += 3 + (k.includes(' ') ? 1 : 0)
    for (const k of WORRY_WORDS[s.id] ?? []) if (hasWord(lower, k)) score += 2 + (k.includes(' ') ? 1 : 0)
    if (score > 0) out.push({ situation: s, score })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Closest topic chip by spelling, for typos like "anxeity" or "lonley". */
export function nearestSituation(q: string): Situation | null {
  const tokens = normal(q).split(/[^a-z']+/).filter((t) => t.length >= 4)
  let best: { s: Situation; d: number } | null = null
  for (const s of SITUATIONS) {
    const words = [s.label.toLowerCase(), s.id, ...s.keywords, ...(WORRY_WORDS[s.id] ?? [])].filter(
      (w) => !w.includes(' '),
    )
    for (const t of tokens) {
      for (const w of words) {
        if (Math.abs(w.length - t.length) > 2) continue
        const d = editDistance(t, w)
        const limit = t.length >= 7 ? 2 : 1
        if (d <= limit && (!best || d < best.d)) best = { s, d }
      }
    }
  }
  return best?.s ?? null
}

/** Should a search box query go to Name it instead of word search? */
export function looksLikeCircumstance(q: string): boolean {
  const t = q.trim()
  if (!t) return false
  if (parseReference(t)) return false
  if (CIRC_HINT.test(t)) return true
  const lower = normal(t)
  if (SITUATIONS.some((s) => s.id === lower || s.label.toLowerCase() === lower)) return true
  // Longer sentences about a situation ("my dad is in hospital") go to Name it; single words stay a word search.
  return lower.split(' ').length >= 3 && scoreSituations(lower).length > 0
}

async function hydrateMatch(
  m: Situation['matches'][0],
  index: SearchHit[],
): Promise<SituationMatch> {
  const hit = index.find(
    ([b, c, v]) => b === m.book && c === m.chapter && v === m.verse,
  )
  return {
    ref: formatRef(m.book, m.chapter, m.verse),
    book: m.book,
    chapter: m.chapter,
    verse: m.verse,
    text: hit?.[3] ?? '',
    thenSense: m.thenSense,
  }
}

export type NameResult = {
  source: 'curated' | 'keyword' | 'xai' | 'nearest' | 'none'
  situation?: Situation
  /** Other topics that also fit what was typed. */
  related?: string[]
  /** Closest topic chip when nothing matched. */
  nearest?: string
  matches: SituationMatch[]
  note?: string
}

export async function nameCircumstance(q: string): Promise<NameResult> {
  const key = `then:circ:4:${q.trim().toLowerCase()}`
  try {
    const cached = localStorage.getItem(key)
    if (cached) return JSON.parse(cached) as NameResult
  } catch {
    /* ignore */
  }

  const index = await loadSearchIndex()
  const lower = normal(q)
  const save = (r: NameResult) => {
    try {
      localStorage.setItem(key, JSON.stringify(r))
    } catch {
      /* ignore */
    }
    return r
  }

  const ranked = scoreSituations(lower)
  if (ranked.length) {
    const curated = ranked[0].situation
    const matches = await Promise.all(curated.matches.map((m) => hydrateMatch(m, index)))
    return save({
      source: 'curated',
      situation: curated,
      related: ranked.slice(1, 4).map((r) => r.situation.id),
      matches,
    })
  }

  const near = nearestSituation(lower)
  if (near) {
    const matches = await Promise.all(near.matches.map((m) => hydrateMatch(m, index)))
    return save({ source: 'nearest', situation: near, matches })
  }

  // Optional xAI -- never crash if missing
  const apiKey =
    (typeof import.meta !== 'undefined' &&
      (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_XAI_API_KEY) ||
    ''
  if (apiKey) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [
            {
              role: 'system',
              content:
                'Reply JSON only: {"refs":[{"book":"psa","chapter":23,"verse":4,"thenSense":"..."}]} using Protestant book ids. Max 6.',
            },
            { role: 'user', content: q },
          ],
          temperature: 0.2,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[]
        }
        const raw = data.choices?.[0]?.message?.content ?? '{}'
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as {
          refs?: { book: string; chapter: number; verse: number; thenSense?: string }[]
        }
        if (parsed.refs?.length) {
          const matches = await Promise.all(
            parsed.refs.slice(0, 6).map((m) => hydrateMatch(m, index)),
          )
          return save({
            source: 'xai',
            matches,
            note: 'Suggested verses. Read each one in its chapter.',
          })
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Whole-word fallback against the verse index.
  const STOP = new Set(['about', 'after', 'again', 'being', 'could', 'feel', 'from', 'have', 'just', 'like', 'really', 'that', 'there', 'they', 'this', 'what', 'when', 'with', 'would', 'your', 'some', 'very', 'been', 'into', 'over', 'feeling'])
  const tokens = lower.split(/[^a-z']+/).filter((t) => t.length > 3 && !STOP.has(t))
  const res = tokens.map((t) => new RegExp(`(^|[^a-z])${escapeRe(t)}(s|es|ed|ing)?($|[^a-z])`, 'i'))
  const scored: { hit: SearchHit; score: number }[] = []
  if (res.length) {
    for (const hit of index) {
      let score = 0
      for (const re of res) if (re.test(hit[3])) score++
      if (score > 0) scored.push({ hit, score })
    }
  }
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ hit }) => ({
      ref: formatRef(hit[0], hit[1], hit[2]),
      book: hit[0],
      chapter: hit[1],
      verse: hit[2],
      text: hit[3],
    }))

  return save({
    source: top.length ? 'keyword' : 'none',
    matches: top,
    note: top.length
      ? undefined
      : 'Nothing close yet. Try a feeling word like grief, fear or hope, or tap a topic above.',
  })
}
