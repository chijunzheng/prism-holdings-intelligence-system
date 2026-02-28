// ResearchBriefCard — expandable research brief preview.
// Collapsed: signal name, quality score, impact range
// Expanded: full 10-section brief rendered inline

import { useState } from 'react'
import type { ResearchBrief } from '@prism/shared'

interface ResearchBriefCardProps {
  readonly data: unknown
}

function formatDollar(n: number): string {
  const sign = n < 0 ? '-' : '+'
  return `${sign}$${Math.abs(n).toLocaleString()}`
}

export function ResearchBriefCard({ data }: ResearchBriefCardProps) {
  const brief = data as ResearchBrief
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="chat-card chat-card--research-brief">
      <button
        className="chat-card__expand-trigger"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="chat-card__brief-preview">
          <span className="chat-card__brief-title">Research Brief</span>
          <span className="chat-card__quality-badge">
            Quality: {(brief.qualityScore * 100).toFixed(0)}%
          </span>
        </div>
        <div className="chat-card__brief-impact">
          <span>
            Impact: {formatDollar(brief.impactRange.low)} to {formatDollar(brief.impactRange.high)}
          </span>
          <span className="chat-card__chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {expanded && (
        <div className="chat-card__brief-full">
          {brief.sections.map((section, i) => (
            <div key={i} className="chat-card__brief-section">
              <h5>{section.title}</h5>
              <div className="chat-card__brief-content">
                {section.content.split('\n').map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          <div className="chat-card__disclaimer">{brief.disclaimer}</div>
        </div>
      )}
    </div>
  )
}
