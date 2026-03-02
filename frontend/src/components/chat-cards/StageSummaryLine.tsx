// StageSummaryLine — two-line row for a completed pipeline stage.
// Line 1: ✓ Stage Label + View details ›
// Line 2: Full completion message (not truncated)
// Every stage is clickable — links to Action Center for full details.

import type { ActionCenterMode, StageSummaryData } from './types'

interface StageSummaryLineProps {
  readonly data: StageSummaryData
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

export function StageSummaryLine({ data, onActionCenterMode }: StageSummaryLineProps) {
  // Always clickable: use stored mode if available, otherwise fall back to generic detail view
  const effectiveMode: ActionCenterMode = data.actionCenterMode ?? {
    mode: 'stage_summary_detail',
    stageLabel: data.stageLabel,
    summary: data.summary,
  }
  const isClickable = onActionCenterMode !== undefined

  function handleClick(): void {
    if (isClickable) {
      onActionCenterMode!(effectiveMode)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      className={`stage-summary-line${isClickable ? ' stage-summary-line--clickable' : ''}`}
      role={isClickable ? 'button' : undefined}
      aria-label={isClickable ? `View details for ${data.stageLabel}` : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
    >
      <div className="stage-summary-line__header">
        <span className="stage-summary-line__icon">{'\u2713'}</span>
        <span className="stage-summary-line__label">{data.stageLabel}</span>
        {isClickable && (
          <span className="stage-summary-line__action">View details &rsaquo;</span>
        )}
      </div>
      {data.summary && (
        <div className="stage-summary-line__summary">{data.summary}</div>
      )}
    </div>
  )
}
