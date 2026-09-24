import type { ThenCard } from '../lib/then-sense'

export function CatchesStrip({
  catches,
  onSelect,
}: {
  catches: ThenCard[]
  onSelect: (card: ThenCard) => void
}) {
  if (!catches.length) return null
  const n = catches.length
  return (
    <div className="catches-strip">
      <p className="catches-strip-count">
        {n} {n === 1 ? 'original note' : 'original notes'} in this chapter
      </p>
      <div className="catches-strip-chips">
        {catches.map((c) => (
          <button
            key={c.id}
            type="button"
            className="catches-chip"
            title={c.note}
            onClick={() => onSelect(c)}
          >
            {c.then}
          </button>
        ))}
      </div>
    </div>
  )
}
