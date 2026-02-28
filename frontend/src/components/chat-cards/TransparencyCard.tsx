// TransparencyCard — expandable "How we estimated this" with full derivation.

import { useState } from 'react'

interface TransparencyData {
  readonly title: string
  readonly summary: string
  readonly derivation: string
  readonly sources?: readonly string[]
}

interface TransparencyCardProps {
  readonly data: unknown
}

export function TransparencyCard({ data }: TransparencyCardProps) {
  const transparency = data as TransparencyData
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="chat-card chat-card--transparency">
      <button
        className="chat-card__expand-trigger"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span>{transparency.title}</span>
        <span className="chat-card__chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {!expanded && (
        <p className="chat-card__summary">{transparency.summary}</p>
      )}

      {expanded && (
        <div className="chat-card__expanded">
          <pre className="chat-card__derivation">{transparency.derivation}</pre>
          {transparency.sources && transparency.sources.length > 0 && (
            <div className="chat-card__sources">
              <h5>Sources</h5>
              <ul>
                {transparency.sources.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
