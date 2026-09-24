/** English + Hebrew original-translation cards: modern sense vs original wording (not a sermon). */

export interface ThenCard {
  id: string
  /** English word (or primary gloss) used to match chapter / search text. */
  word: string
  modern: string
  /** Short original-translation phrase — gallery title / catch chip. */
  then: string
  note: string
  refs: string[]
  strongs?: string[]
  /** Extra English / transliteration needles for search & chapter catches. */
  aliases?: string[]
  xlit?: string
  native?: string
  /** Longer original-translation paragraph for the word page. */
  longThen?: string
}

export const THEN_CARDS: ThenCard[] = [
  // —— Hebrew original-translation cards (Grok gallery tone) ——
  {
    id: 'reshit',
    word: 'beginning',
    modern: 'a moment on a clock',
    then: 'head / first-part',
    note: 'English “in the beginning” makes it a moment on a clock. The Hebrew is a noun of rank and first-fruits.',
    refs: ['Genesis 1:1'],
    strongs: ['H7225'],
    aliases: ['beginnings'],
    xlit: 'rēʾšît',
    native: 'רֵאשִׁית',
    longThen:
      'Rēʾšît is a head — first-fruits, chief part, the leading edge of a thing. English “in the beginning” sounds like a stopwatch. The Hebrew opens with rank and firstness, not a timestamp alone.',
  },
  {
    id: 'bara',
    word: 'created',
    modern: 'creatio ex nihilo',
    then: 'to shape / bring forth',
    note: '“Created” in modern English smuggles in creatio ex nihilo, a doctrine the word itself does not carry.',
    refs: ['Genesis 1:1', 'Genesis 1:27', 'Isaiah 45:18'],
    strongs: ['H1254'],
    aliases: ['create', 'createth'],
    xlit: 'bārāʾ',
    native: 'בָּרָא',
    longThen:
      'Bārāʾ is to shape, form, bring forth. Later theology may hear “out of nothing”; the verb itself does not require that freight. It marks divine agency in making — without smuggling a medieval doctrine into the root.',
  },
  {
    id: 'elohim',
    word: 'God',
    modern: 'a single proper name',
    then: 'god / gods / divine council',
    note: '“God” flattens a title that could mean deity, council, or powerful ones into a single proper name.',
    refs: ['Genesis 1:1', 'Psalm 82:1', 'Exodus 20:3'],
    strongs: ['H430'],
    aliases: ['gods'],
    xlit: 'ʾĕlōhîm',
    native: 'אֱלֹהִים',
    longThen:
      'ʾĔlōhîm is a title that can land as deity, gods, or the divine council — not only the later English proper name “God.” Context decides whether you hear singular majesty or plural court.',
  },
  {
    id: 'hesed',
    word: 'mercy',
    modern: 'warm feeling / pity',
    then: 'covenant loyalty',
    note: '“Lovingkindness” and “mercy” turn a social-legal duty into an emotion.',
    refs: ['Exodus 34:6', 'Psalms 136:1', 'Micah 6:8'],
    strongs: ['H2617'],
    aliases: ['lovingkindness', 'kindness', 'mercies', 'hesed', 'chesed', 'ḥesed'],
    xlit: 'ḥesed',
    native: 'חֶסֶד',
    longThen:
      'Ḥesed is what you owe inside a bond. Kin, treaty-partners, and patrons do ḥesed: they keep faith when the relationship costs them. It is closer to loyal action than to a warm feeling. You can be commanded to do it. You can fail it. In the world of suzerain treaties and clan obligation, ḥesed is the glue — not sentiment, not generic kindness.',
  },
  {
    id: 'nepesh',
    word: 'soul',
    modern: 'immortal essence',
    then: 'throat / living self',
    note: '“Soul” imports a later Greek-Christian immortal essence the Hebrew does not hold.',
    refs: ['Genesis 2:7', 'Genesis 1:20', 'Psalm 42:1'],
    strongs: ['H5315'],
    aliases: ['souls', 'nephesh', 'nepeš', 'living'],
    xlit: 'nepeš',
    native: 'נֶפֶשׁ',
    longThen:
      'Nepeš is throat, appetite, the living self that breathes and wants. English “soul” often imports a detachable immortal essence. The Hebrew stays closer to life-force in a body — the self that can be hungry, poured out, or gathered.',
  },
  {
    id: 'ruach',
    word: 'spirit',
    modern: 'an inner person',
    then: 'wind / breath / force',
    note: '“Spirit” makes it an inner person. The word is weather, breath, and agency.',
    refs: ['Genesis 1:2', 'Genesis 8:1', 'Ezekiel 37:9'],
    strongs: ['H7307'],
    aliases: ['spirits', 'ruach', 'rûaḥ'],
    xlit: 'rûaḥ',
    native: 'רוּחַ',
    longThen:
      'Rûaḥ is wind, breath, and force — weather you feel, breath you share, agency that moves. English “Spirit” can shrink it to an inner ghost. The Hebrew keeps the outdoors in the word.',
  },
  {
    id: 'shalom',
    word: 'peace',
    modern: 'absence of war / a calm mood',
    then: 'wholeness / welfare',
    note: '“Peace” in English often means the absence of war or a mood. Šālôm is completeness.',
    refs: ['Numbers 6:26', 'Isaiah 9:6', 'Jeremiah 29:7'],
    strongs: ['H7965'],
    aliases: ['shalom', 'šālôm'],
    xlit: 'šālôm',
    native: 'שָׁלוֹם',
    longThen:
      'Šālôm is wholeness, welfare, things as they ought to be. English “peace” often means ceasefire or a calm mood. The Hebrew aims at completeness — a life, a city, a body set right.',
  },
  {
    id: 'olam',
    word: 'forever',
    modern: 'timeless eternity',
    then: 'vanishing horizon',
    note: '“Forever” and “eternal” import later ideas of timelessness.',
    refs: ['Genesis 9:12', 'Psalm 90:2', 'Ecclesiastes 3:11'],
    strongs: ['H5769'],
    aliases: ['everlasting', 'eternal', 'evermore', 'olam', 'ʿôlām'],
    xlit: 'ʿôlām',
    native: 'עוֹלָם',
    longThen:
      'ʿÔlām is the vanishing horizon — as far as you can see, the concealed age. “Forever” and “eternal” can smuggle in later metaphysics of pure timelessness. The Hebrew is often long duration that slips out of view.',
  },
  {
    id: 'berit',
    word: 'covenant',
    modern: 'spiritual agreement',
    then: 'treaty / bond',
    note: '“Covenant” in church use often means a spiritual agreement. The word is a treaty you can break and be broken by.',
    refs: ['Genesis 15:18', 'Exodus 24:8', 'Jeremiah 31:31'],
    strongs: ['H1285'],
    aliases: ['covenants', 'berith', 'berît'],
    xlit: 'berît',
    native: 'בְּרִית',
    longThen:
      'Berît is a treaty-bond — cut, sworn, and enforceable. Church English often softens it into a vague spiritual agreement. In its world it is something you can break, and be broken by.',
  },

  // —— English KJV original-translation cards (kept) ——
  {
    id: 'world',
    word: 'world',
    modern: 'the planet / everyone',
    then: 'an ordered age, a system, or the inhabited order (κόσμος / תֵּבֵל) — not always the globe',
    note: 'In John, “world” often names the rebellious order opposed to God, not mere geography.',
    refs: ['John 3:16', 'John 17:14', '1 John 2:15'],
    strongs: ['G2889'],
  },
  {
    id: 'believe',
    word: 'believe',
    modern: 'agree a claim is true',
    then: 'trust / entrust yourself to (πιστεύω) — loyalty as much as assent',
    note: 'Biblical “believe” leans toward reliance, not bare opinion.',
    refs: ['John 3:16', 'Genesis 15:6', 'Romans 4:3'],
    strongs: ['G4100', 'H539'],
  },
  {
    id: 'repent',
    word: 'repent',
    modern: 'feel sorry',
    then: 'turn / change mind and direction (μετανοέω / שׁוּב)',
    note: 'Sorrow may accompany it; the word itself aims at turning.',
    refs: ['Matthew 4:17', 'Acts 2:38', 'Joel 2:12'],
    strongs: ['G3340', 'H7725'],
  },
  {
    id: 'hell',
    word: 'hell',
    modern: 'fiery afterlife default',
    then: 'Sheol / Hades / Gehenna — distinct places/images the KJV often collapses to “hell”',
    note: 'Read the underlying term before building doctrine from the English alone.',
    refs: ['Psalm 16:10', 'Matthew 5:22', 'Luke 16:23'],
    strongs: ['H7585', 'G86', 'G1067'],
  },
  {
    id: 'church',
    word: 'church',
    modern: 'a building / Sunday institution',
    then: 'assembly / called-out people (ἐκκλησία)',
    note: 'Buildings came later; the word names people gathered.',
    refs: ['Matthew 16:18', 'Acts 2:47', 'Ephesians 5:25'],
    strongs: ['G1577'],
  },
  {
    id: 'word',
    word: 'word',
    modern: 'a vocabulary item',
    then: 'speech, message, reason, or the living Logos (דָּבָר / λόγος)',
    note: 'In John 1, Word is personal — not a dictionary entry.',
    refs: ['John 1:1', 'Psalm 119:105', 'Hebrews 4:12'],
    strongs: ['G3056', 'H1697'],
  },
  {
    id: 'flesh',
    word: 'flesh',
    modern: 'body tissue / lust only',
    then: 'human frailty, embodied life, or the old Adamic pattern (בָּשָׂר / σάρξ)',
    note: 'Context decides: incarnation, weakness, or opposition to Spirit.',
    refs: ['John 1:14', 'Romans 8:5', 'Genesis 6:3'],
    strongs: ['G4561', 'H1320'],
  },
  {
    id: 'perfect',
    word: 'perfect',
    modern: 'flawless / without error',
    then: 'complete, mature, whole (τέλειος / תָּמִים)',
    note: 'Often maturity or wholeness rather than zero defects.',
    refs: ['Matthew 5:48', 'James 1:4', 'Genesis 6:9'],
    strongs: ['G5046', 'H8549'],
  },
  {
    id: 'conversation',
    word: 'conversation',
    modern: 'talk / dialogue',
    then: 'manner of life / conduct (ἀναστροφή)',
    note: 'KJV “conversation” rarely means chatting.',
    refs: ['Philippians 1:27', '1 Peter 1:15', 'Hebrews 13:5'],
    strongs: ['G391'],
  },
  {
    id: 'charity',
    word: 'charity',
    modern: 'nonprofit giving',
    then: 'love (ἀγάπη) — costly regard',
    note: 'Paul’s “charity” is love, not the donation box.',
    refs: ['1 Corinthians 13:1', '1 Peter 4:8'],
    strongs: ['G26'],
  },
  {
    id: 'quick',
    word: 'quick',
    modern: 'fast',
    then: 'living / alive',
    note: '“Quick and the dead” = living and dead.',
    refs: ['Acts 10:42', '2 Timothy 4:1', 'Hebrews 4:12'],
    strongs: ['G2198'],
  },
  {
    id: 'suffer',
    word: 'suffer',
    modern: 'feel pain only',
    then: 'allow / permit (often)',
    note: '“Suffer the little children” = let them come.',
    refs: ['Matthew 19:14', 'Mark 10:14'],
  },
  {
    id: 'prevent',
    word: 'prevent',
    modern: 'stop from happening',
    then: 'go before / precede',
    note: 'Older English: to come before.',
    refs: ['Psalm 59:10', '1 Thessalonians 4:15'],
  },
  {
    id: 'meat',
    word: 'meat',
    modern: 'animal flesh',
    then: 'food in general',
    note: '“Meat” once meant sustenance.',
    refs: ['Genesis 1:29', 'John 4:34', 'Matthew 6:25'],
  },
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function needlesFor(card: ThenCard): string[] {
  return [card.word, ...(card.aliases ?? [])].filter(Boolean)
}

export function thenCardById(id: string): ThenCard | undefined {
  const key = id.toLowerCase()
  return THEN_CARDS.find(
    (c) =>
      c.id === key ||
      c.word.toLowerCase() === key ||
      c.strongs?.some((s) => s.toLowerCase() === key) ||
      c.xlit?.toLowerCase() === key ||
      c.aliases?.some((a) => a.toLowerCase() === key),
  )
}

export function thenSenseForText(text: string): ThenCard[] {
  const lower = text.toLowerCase()
  return THEN_CARDS.filter((c) =>
    needlesFor(c).some((n) => new RegExp(`\\b${escapeRe(n.toLowerCase())}\\b`, 'i').test(lower)),
  )
}

export function notableThenSense(verseText: string): ThenCard | undefined {
  return thenSenseForText(verseText)[0]
}

/** Unique original-translation cards found across a chapter’s English verses. */
export function catchesInChapter(verses: string[]): ThenCard[] {
  const seen = new Set<string>()
  const out: ThenCard[] = []
  for (const v of verses) {
    for (const c of thenSenseForText(v)) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
  }
  return out
}

/** Match a search query to an original-translation card (word, alias, xlit, then phrase). */
export function matchThenCardQuery(q: string): ThenCard | undefined {
  const needle = q.trim().toLowerCase()
  if (!needle) return undefined
  const exact = THEN_CARDS.find((c) => {
    const pool = [
      c.word,
      c.id,
      c.xlit,
      c.then,
      ...(c.aliases ?? []),
      ...(c.strongs ?? []),
    ]
      .filter(Boolean)
      .map((s) => s!.toLowerCase())
    return pool.some((p) => p === needle || p.replace(/[ʾʿḥšôāēīūǝ]/g, '') === needle)
  })
  if (exact) return exact
  return THEN_CARDS.find((c) => {
    const pool = [c.word, c.then, c.xlit, ...(c.aliases ?? [])].filter(Boolean).map((s) => s!.toLowerCase())
    return pool.some((p) => p.includes(needle) || needle.includes(p))
  })
}
