import { useState } from 'react'
import { Link } from '@tanstack/react-router'

export interface TourCatch {
  label: string
  body: string
  /** Optional Hebrew fragment to highlight conceptually. */
  hebrewHint?: string
}

const BERESHIT_CATCHES: TourCatch[] = [
  {
    label: 'in / at the head of',
    hebrewHint: 'בְּ',
    body:
      'A prefixed preposition, not a separate “in.” Hebrew glues the relation to the noun. The verse does not pause for a capital-B Beginning; it opens already inside something.',
  },
  {
    label: 'head / first-part',
    hebrewHint: 'רֵאשִׁית',
    body:
      'Rēʾšît is rank and first-fruits — a head, not a stopwatch. English “beginning” hears a moment; the Hebrew hears the leading edge of an ordered account.',
  },
  {
    label: 'to shape / bring forth',
    hebrewHint: 'בָּרָא',
    body:
      'Bārāʾ is to shape / bring forth. “Created” can smuggle in creatio ex nihilo; the verb itself marks divine agency in making, without that later freight.',
  },
  {
    label: 'god / gods / divine council',
    hebrewHint: 'אֱלֹהִים',
    body:
      'ʾĔlōhîm is a title that can mean deity, gods, or the divine council. English “God” flattens a word that sometimes opens onto a court, not only a proper name.',
  },
  {
    label: 'the object marker',
    hebrewHint: 'אֵת',
    body:
      'ʾĒt marks the definite object — grammar you feel more than translate. It points: these skies, this land. English has no tidy single word for the finger on the noun.',
  },
  {
    label: 'the skies',
    hebrewHint: 'הַשָּׁמַיִם',
    body:
      'Ha-shamayim — the skies / heavens. Not a distant “heaven” as a default afterlife, but the heights above: weather, birds, and the vault of the account.',
  },
  {
    label: 'land, earth, ground',
    hebrewHint: 'הָאָרֶץ',
    body:
      'Ha-aretz is land, earth, ground — the soil underfoot and the inhabited place. English “earth” can sound planetary; the Hebrew often stays closer to land you can stand on.',
  },
]

export function TourWalk({
  eyebrow = 'A walk through a verse · Genesis 1:1',
  title = 'Seven words, each a world',
  subtitle = 'Genesis 1:1 in English, then the Hebrew where it actually changes the sense.',
  english = 'In the beginning God created the heaven and the earth.',
  hebrew = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃',
  catches = BERESHIT_CATCHES,
}: {
  eyebrow?: string
  title?: string
  subtitle?: string
  english?: string
  hebrew?: string
  catches?: TourCatch[]
}) {
  const [i, setI] = useState(0)
  const [showHe, setShowHe] = useState(true)
  const catch_ = catches[i] ?? catches[0]
  const total = catches.length

  return (
    <div className="tour-walk">
      <p className="tour-walk-eyebrow">{eyebrow}</p>
      <h1 className="tour-walk-title">{title}</h1>
      <p className="tour-walk-sub muted">{subtitle}</p>

      <p className="tour-walk-english">{english}</p>
      <button type="button" className="tour-walk-toggle" onClick={() => setShowHe((v) => !v)}>
        {showHe ? 'Hide the original line' : 'See the Hebrew'}
      </button>
      {showHe && (
        <p className="tour-walk-hebrew" dir="rtl" lang="he">
          {hebrew}
        </p>
      )}

      <div className="tour-walk-card">
        <p className="tour-walk-progress">
          {i + 1} / {total}
        </p>
        <h2>{catch_.label}</h2>
        {catch_.hebrewHint && (
          <p className="tour-walk-hint" dir="rtl" lang="he">
            {catch_.hebrewHint}
          </p>
        )}
        <p>{catch_.body}</p>
      </div>

      <div className="tour-walk-nav">
        <button
          type="button"
          className="reader-ghost"
          disabled={i === 0}
          onClick={() => setI(0)}
          aria-label="Restart"
        >
          ↺
        </button>
        <button
          type="button"
          className="book-index-cta"
          onClick={() => setI((x) => Math.min(total - 1, x + 1))}
          disabled={i >= total - 1}
        >
          {i >= total - 1 ? 'Last catch' : 'Next catch'}
        </button>
      </div>

      <div className="tour-walk-chips" role="tablist" aria-label="Catches">
        {catches.map((c, idx) => (
          <button
            key={c.label}
            type="button"
            role="tab"
            aria-selected={idx === i}
            className={`tour-walk-chip${idx === i ? ' active' : ''}`}
            onClick={() => setI(idx)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="tour-walk-open">
        <Link
          to="/read/$book/$chapter"
          params={{ book: 'gen', chapter: '1' }}
          search={{ v: 1, mode: 'gap' }}
          className="reader-ghost"
        >
          Open Genesis 1:1
        </Link>
      </p>
    </div>
  )
}

export { BERESHIT_CATCHES }
