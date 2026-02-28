// PipelineProgressCard — vertical progress tracker for multi-agent pipeline stages.
// Shows completed stages (checkmark), active stage (spinner), and pending stages (dimmed).

interface StageInfo {
  readonly id: string
  readonly label: string
  readonly status: 'pending' | 'active' | 'complete'
  readonly message?: string
}

interface PipelineProgressData {
  readonly stages: readonly StageInfo[]
  readonly error?: string
}

interface PipelineProgressCardProps {
  readonly data: unknown
}

export function PipelineProgressCard({ data }: PipelineProgressCardProps) {
  const progress = data as PipelineProgressData
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
              {stage.status === 'pending' && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="var(--color-border, #E8E5E1)" strokeWidth="1.5" />
                </svg>
              )}
            </span>
            <span className="pipeline-progress__stage-label">{stage.label}</span>
            {stage.status === 'complete' && stage.message && (
              <span className="pipeline-progress__stage-detail">{stage.message}</span>
            )}
          </div>
        ))}
      </div>
      {hasError && (
        <div className="pipeline-progress__error">{progress.error}</div>
      )}
    </div>
  )
}
