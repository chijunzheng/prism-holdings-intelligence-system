import { useState } from 'react'

interface SummaryBlockProps {
  readonly summary: string
}

function extractKeyTakeaways(summary: string): ReadonlyArray<string> {
  // Split on sentence boundaries, filter meaningful ones
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)

  // Take first 3 sentences as key takeaways
  return sentences.slice(0, 3)
}

export function SummaryBlock({ summary }: SummaryBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const takeaways = extractKeyTakeaways(summary)
  const hasMore = summary.length > takeaways.join(' ').length + 10

  return (
    <div className="summary-block">
      <ul className="summary-block__takeaways">
        {takeaways.map((point) => (
          <li key={point.slice(0, 40)} className="summary-block__point">
            {point}
          </li>
        ))}
      </ul>

      {hasMore && (
        <>
          {expanded && (
            <p className="summary-block__full">{summary}</p>
          )}
          <button
            type="button"
            className="summary-block__toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show less' : 'Read full analysis'}
          </button>
        </>
      )}
    </div>
  )
}
