import { formatRef, getBook } from '../lib/bible/books'
import { catchesInChapter, firstThenSensePerChapter } from '../lib/then-sense'
import { useMemo } from 'react'
import { pressable } from './pressable'
import type { OrigWord, ReadMode } from '../lib/bible/types'
import type { WordPanelTarget } from './word-panel'
import { CatchesStrip } from './catches-strip'
import { useAppStore } from '../lib/store'

export function ChapterBlock({
  book,
  chapter,
  en,
  orig,
  mode,
  highlightVerse,
  onWord,
  showCatches = false,
}: {
  book: string
  chapter: number
  en: string[]
  orig: OrigWord[][] | null
  mode: ReadMode
  highlightVerse?: number
  onWord: (t: WordPanelTarget) => void
  /** Lead chapter: show “N original notes in this chapter” strip. */
  showCatches?: boolean
}) {
  const marks = useAppStore((s) => s.verseMarks)
  const b = getBook(book)
  const isHebrew = b?.testament === 'ot'
  const chapterCatches = showCatches ? catchesInChapter(en) : []
  const chips = useMemo(() => firstThenSensePerChapter(en), [en])

  return (
    <section className="chapter-block" data-book={book} data-chapter={chapter}>
      <h2>{formatRef(book, chapter)}</h2>
      {showCatches && (
        <CatchesStrip
          catches={chapterCatches}
          onSelect={(c) => {
            if (c.strongs?.[0]) {
              onWord({
                kind: 'orig',
                text: c.native || c.then,
                strong: c.strongs[0],
                lemma: c.native,
              })
            } else {
              onWord({ kind: 'verse', text: `${c.word}: ${c.then}. ${c.note}` })
            }
          }}
        />
      )}
      {en.map((text, i) => {
        const verse = i + 1
        const marked = marks.some(
          (m) => m.book === book && m.chapter === chapter && m.verse === verse,
        )
        const caveat = chips.get(i)
        const ow = orig?.[i] ?? null
        const hl = highlightVerse === verse
        const verseId = `v-${book}-${chapter}-${verse}`
        const verseTarget: WordPanelTarget = {
          kind: 'verse',
          text,
          book,
          chapter,
          verse,
          words: ow ?? undefined,
        }

        if (mode === 'orig' && ow) {
          return (
            <div
              key={verse}
              id={verseId}
              className={`gap-row${marked ? ' marked' : ''}`}
            >
              <div className="muted">
                <span className="verse-num">{verse}</span>
              </div>
              <div
                className={`orig-line${isHebrew ? '' : ' greek'}`}
                dir={isHebrew ? 'rtl' : 'ltr'}
              >
                {ow.map((w, wi) => (
                  <span
                    key={wi}
                    className="orig-word"
                    {...pressable(() =>
                      onWord({
                        kind: 'orig',
                        text: w.t,
                        word: w,
                        strong: w.s,
                        morph: w.m,
                        lemma: w.l,
                        book,
                        chapter,
                        verse,
                      }))}
                  >
                    {w.t}{' '}
                  </span>
                ))}
              </div>
            </div>
          )
        }

        if (mode === 'gap') {
          return (
            <div
              key={verse}
              id={verseId}
              className={`gap-row${marked ? ' marked' : ''}`}
            >
              <p
                className={`verse${marked ? ' marked' : ''}${hl ? ' is-highlight' : ''}`}
                data-hl={hl || undefined}
              >
                <span className="verse-num">{verse}</span>
                <span className="verse-text" {...pressable(() => onWord(verseTarget))}>
                  {text}
                </span>
                {caveat && (
                  <button type="button" className="caveat-chip" onClick={() => onWord(verseTarget)}>
                    original · {caveat.word}
                  </button>
                )}
              </p>
              {ow && (
                <div
                  className={`orig-line${isHebrew ? '' : ' greek'}`}
                  dir={isHebrew ? 'rtl' : 'ltr'}
                >
                  {ow.map((w, wi) => (
                    <span
                      key={wi}
                      className="orig-word"
                      {...pressable(() =>
                        onWord({
                          kind: 'orig',
                          text: w.t,
                          word: w,
                          strong: w.s,
                          morph: w.m,
                          lemma: w.l,
                          book,
                          chapter,
                          verse,
                        }))}
                    >
                      {w.t}{' '}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        }

        // en default
        return (
          <p
            key={verse}
            className={`verse${marked ? ' marked' : ''}${hl ? ' is-highlight' : ''}`}
            id={verseId}
            data-hl={hl || undefined}
          >
            <span className="verse-num">{verse}</span>
            <span className="verse-text" {...pressable(() => onWord(verseTarget))}>
              {text}
            </span>
            {caveat && (
              <button
                type="button"
                className="caveat-chip"
                title={caveat.then}
                onClick={() => onWord(verseTarget)}
              >
                original · {caveat.word}
              </button>
            )}
          </p>
        )
      })}
    </section>
  )
}
