// ResearchBriefCard — compact chip with View and Download actions.
// Full brief rendering moved to Action Center.

import type { ResearchBrief } from '@prism/shared'
import type { ActionCenterMode } from './types'
import { downloadBrief } from '../../utils/download-brief'

interface ResearchBriefCardProps {
  readonly data: unknown
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

function formatDollar(n: number): string {
  const sign = n < 0 ? '-' : '+'
  return `${sign}$${Math.abs(n).toLocaleString()}`
}

export function ResearchBriefCard({ data, onActionCenterMode }: ResearchBriefCardProps) {
  const brief = data as ResearchBrief

  function handleView() {
    onActionCenterMode?.({ mode: 'research_brief', brief })
  }

  function handleDownload() {
    downloadBrief(brief)
  }

  return (
    <div className="chat-card chat-card--compact research-brief-chip">
      <span className="research-brief-chip__icon" aria-hidden="true">&#128196;</span>
      <span className="research-brief-chip__title">Research Brief</span>
      <div className="research-brief-chip__meta">
        <span>Quality: {(brief.qualityScore * 100).toFixed(0)}%</span>
        <span className="research-brief-chip__meta-divider">|</span>
        <span>
          Impact: {formatDollar(brief.impactRange.low)} to {formatDollar(brief.impactRange.high)}
        </span>
      </div>
      <div className="research-brief-chip__actions">
        <button
          type="button"
          className="research-brief-chip__btn"
          onClick={handleView}
        >
          View
        </button>
        <button
          type="button"
          className="research-brief-chip__btn"
          onClick={handleDownload}
        >
          Download &darr;
        </button>
      </div>
    </div>
  )
}
