// PipelineProgressCard — vertical progress tracker for multi-agent pipeline stages.
// Shows completed stages (checkmark), active stage (spinner), and pending stages (dimmed).

import type { PipelineProgressData } from './types'

interface PipelineProgressCardProps {
  readonly data: PipelineProgressData
}

export function PipelineProgressCard({ data }: PipelineProgressCardProps) {
  const progress = data
  const hasError = Boolean(progress.error)

  return (
    <div className="pipeline-progress">
      <div className="pipeline-progress__header">
        <span className="pipeline-progress__icon">&#9671;</span>
        <span className="pipeline-progress__title">Prism Analysis Pipeline</span>
      </div>
      <div className="pipeline-progress__stages">
        {progress.stages.map((stage) => (
          <div
            key={stage.id}
            className={`pipeline-progress__stage pipeline-progress__stage--${stage.status}`}
          >
            <span className="pipeline-progress__stage-indicator">
              {stage.status === 'complete' && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="7" fill="var(--color-positive, #16A34A)" />
                  <path d="M4 7.2L6 9.2L10 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {stage.status === 'active' && (
                <span className="pipeline-progress__spinner" />
              )}
              {stage.status === 'waiting' && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="var(--color-warning, #D97706)" strokeWidth="1.5" />
                  <rect x="5" y="4" width="1.5" height="6" rx="0.75" fill="var(--color-warning, #D97706)" />
                  <rect x="7.5" y="4" width="1.5" height="6" rx="0.75" fill="var(--color-warning, #D97706)" />
                </svg>
              )}
              {stage.status === 'pending' && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="var(--color-border, #E8E5E1)" strokeWidth="1.5" />
                </svg>
              )}
            </span>
            <div className="pipeline-progress__stage-content">
              <span className="pipeline-progress__stage-label">{stage.label}</span>
              {stage.status === 'complete' && stage.message && (
                <span className="pipeline-progress__stage-detail">{stage.message}</span>
              )}
              {(stage.status === 'active' || stage.status === 'pending') && stage.thinkingText && (
                <span className="pipeline-progress__thinking-text">{stage.thinkingText}</span>
              )}
              {stage.status === 'waiting' && (
                <span className="pipeline-progress__waiting-text">Waiting for your input</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasError && (
        <div className="pipeline-progress__error">{progress.error}</div>
      )}
    </div>
  )
}
