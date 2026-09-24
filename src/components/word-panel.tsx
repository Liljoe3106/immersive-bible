import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { loadStrongs } from '../lib/bible/load'
import { getBook } from '../lib/bible/books'
import type { OrigWord, StrongEntry } from '../lib/bible/types'
import { thenSenseForText, THEN_CARDS } from '../lib/then-sense'
import { useAppStore } from '../lib/store'

export interface WordPanelTarget {
  kind: 'verse' | 'orig'
  text: string
  strong?: string
  morph?: string
  lemma?: string
  word?: OrigWord
  words?: OrigWord[]
  book?: string
  chapter?: number
  verse?: number
}

export function WordPanel({
  target,
  onClose,
}: {
  target: WordPanelTarget | null
  onClose: () => void
}) {
  const [focus, setFocus] = useState<WordPanelTarget | null>(null)
  const [entry, setEntry] = useState<StrongEntry | null>(null)
  const toggleStrong = useAppStore((s) => s.toggleStrongBookmark)
  const toggleMark = useAppStore((s) => s.toggleVerseMark)
  const bookmarks = useAppStore((s) => s.bookmarks)
  const marks = useAppStore((s) => s.verseMarks)

  useEffect(() => {
    setFocus(null)
  }, [target])

  const active = focus ?? target

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!active) return
      const strong = active.strong || active.word?.s
      if (!strong) {
        setEntry(null)
        return
      }
      const all = await loadStrongs()
      if (!alive) return
      setEntry(all[strong.toUpperCase()] ?? null)
    })()
    return () => {
      alive = false
    }
  }, [active])

  if (!active || !target) return null

  const strong = (active.strong || active.word?.s || '').toUpperCase()
  const morph = active.morph || active.word?.m || ''
  const lemma = active.lemma || active.word?.l || entry?.lemma || ''
  const thenCards =
    active.kind === 'verse'
      ? thenSenseForText(active.text)
      : THEN_CARDS.filter((c) => c.strongs?.includes(strong))
  const bookmarked = strong && bookmarks.some((b) => b.strong === strong)
  const marked =
    active.book != null &&
    active.chapter != null &&
    active.verse != null &&
    marks.some(
      (m) =>
        m.book === active.book &&
        m.chapter === active.chapter &&
        m.verse === active.verse,
    )
  const isHebrew = target.book ? getBook(target.book)?.testament === 'ot' : false
  const verseWords = target.kind === 'verse' ? target.words : undefined

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <aside className="word-panel" role="dialog" aria-label="Word panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h3>{active.kind === 'orig' ? active.word?.t || active.text : 'Verse'}</h3>
          <button type="button" className="reader-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {active.kind === 'verse' && (
          <>
            <p style={{ fontFamily: 'var(--serif-body)', lineHeight: 1.7 }}>{active.text}</p>
            {verseWords && verseWords.length > 0 && (
              <div className="verse-orig-chips" dir={isHebrew ? 'rtl' : 'ltr'}>
                {verseWords.map((w, i) => (
                  <button
                    key={i}
                    type="button"
                    className="verse-orig-chip"
                    onClick={() =>
                      setFocus({
                        kind: 'orig',
                        text: w.t,
                        word: w,
                        strong: w.s,
                        morph: w.m,
                        lemma: w.l,
                        book: target.book,
                        chapter: target.chapter,
                        verse: target.verse,
                      })
                    }
                  >
                    {w.t}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {lemma && (
          <p className="muted">
            Lemma: <strong style={{ color: 'var(--ink)' }}>{lemma}</strong>
          </p>
        )}
        {morph && (
          <p className="muted">
            Morphology: <code>{morph}</code>
          </p>
        )}
        {strong && (
          <p>
            Strong&apos;s:{' '}
            <Link to="/word/$strong" params={{ strong }} style={{ color: '#7a5d10' }}>
              {strong}
            </Link>
          </p>
        )}
        {entry && (
          <div className="card">
            <h3>{entry.xlit || entry.lemma}</h3>
            <p className="muted">{entry.strongs_def || entry.kjv_def}</p>
            {entry.kjv_def && entry.strongs_def !== entry.kjv_def && (
              <p className="muted">KJV: {entry.kjv_def}</p>
            )}
          </div>
        )}
        {thenCards.map((c) => (
          <div className="card" key={c.id}>
            <h3>Original · {c.word}</h3>
            <p className="muted">Modern: {c.modern}</p>
            <p>{c.then}</p>
            <p className="muted">{c.note}</p>
          </div>
        ))}
        <div className="chamber-row" style={{ marginTop: '1rem' }}>
          {strong && (
            <button
              type="button"
              className={`reader-ghost${bookmarked ? ' active' : ''}`}
              onClick={() => toggleStrong(strong)}
            >
              {bookmarked ? 'Bookmarked' : 'Bookmark Strong’s'}
            </button>
          )}
          {active.book && active.chapter && active.verse != null && (
            <button
              type="button"
              className={`reader-ghost${marked ? ' active' : ''}`}
              onClick={() => toggleMark(active.book!, active.chapter!, active.verse!)}
            >
              {marked ? 'Marked' : 'Mark verse'}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
