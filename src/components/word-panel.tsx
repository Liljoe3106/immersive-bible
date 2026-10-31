import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { loadStrongs } from '../lib/bible/load'
import { formatRef, getBook } from '../lib/bible/books'
import { trapTab } from './chapter-picker'
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

  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const open = !!target

  useEffect(() => {
    setFocus(null)
  }, [target])

  // Dialog behaviour: move focus in, trap Tab, Escape closes, focus goes back to where it was.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const el = panelRef.current
    requestAnimationFrame(() => el?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
      } else if (e.key === 'Tab' && el) trapTab(e, el)
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener && document.contains(opener)) opener.focus?.()
    }
  }, [open])

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

  const heading =
    active.kind === 'orig'
      ? active.word?.t || active.text
      : active.book && active.chapter
        ? formatRef(active.book, active.chapter, active.verse)
        : 'Verse'

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <aside
        ref={panelRef}
        className="word-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-panel-title"
        tabIndex={-1}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 id="word-panel-title" className="word-panel-title">
            {heading}
          </h2>
          <div className="chamber-row">
            {focus && (
              <button type="button" className="reader-ghost" onClick={() => setFocus(null)}>
                Back to verse
              </button>
            )}
            <button type="button" className="reader-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {active.kind === 'verse' && (
          <>
            <p style={{ fontFamily: 'var(--serif-body)', lineHeight: 1.7 }}>{active.text}</p>
            {verseWords && verseWords.length > 0 && (
              <>
                <p className="muted word-panel-hint">
                  Tap a {isHebrew ? 'Hebrew' : 'Greek'} word to see what it means.
                </p>
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
              </>
            )}
          </>
        )}
        {entry && (
          <div className="card">
            <h3>
              Meaning
              {entry.xlit ? <span className="muted word-panel-say"> · said “{entry.xlit}”</span> : null}
            </h3>
            <p>{entry.strongs_def || entry.kjv_def}</p>
            {entry.kjv_def && entry.strongs_def !== entry.kjv_def && (
              <p className="muted">In the King James Bible it is translated as: {entry.kjv_def}</p>
            )}
          </div>
        )}
        {active.kind === 'orig' && !entry && strong && <p className="muted">Looking up this word…</p>}
        {thenCards.map((c) => (
          <div className="card" key={c.id}>
            <h3>What “{c.word}” meant then</h3>
            <p>{c.then}</p>
            <p className="muted">Today it usually means: {c.modern}</p>
            <p className="muted">{c.note}</p>
          </div>
        ))}
        {strong && (
          <p>
            <Link to="/word/$strong" params={{ strong }} className="reader-ghost">
              Open word study
            </Link>
          </p>
        )}
        {(lemma || morph || strong) && (
          <details className="word-panel-details">
            <summary>Details</summary>
            {lemma && (
              <p className="muted">
                Dictionary form (lemma): <strong style={{ color: 'var(--ink)' }}>{lemma}</strong>
              </p>
            )}
            {morph && (
              <p className="muted">
                Grammar code (morphology): <code>{morph}</code>
              </p>
            )}
            {strong && <p className="muted">Strong&apos;s number: {strong}</p>}
          </details>
        )}
        <div className="chamber-row" style={{ marginTop: '1rem' }}>
          {strong && (
            <button
              type="button"
              className={`reader-ghost${bookmarked ? ' active' : ''}`}
              aria-pressed={!!bookmarked}
              onClick={() => toggleStrong(strong)}
            >
              {bookmarked ? 'Word saved' : 'Save this word'}
            </button>
          )}
          {active.book && active.chapter && active.verse != null && (
            <button
              type="button"
              className={`reader-ghost${marked ? ' active' : ''}`}
              aria-pressed={!!marked}
              onClick={() => toggleMark(active.book!, active.chapter!, active.verse!)}
            >
              {marked ? 'Verse marked' : 'Mark verse'}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
