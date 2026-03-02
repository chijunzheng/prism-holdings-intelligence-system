import type { TraceNavigatorData } from './types'

interface TraceNavigatorCardProps {
  readonly data: TraceNavigatorData
}

export function TraceNavigatorCard({ data }: TraceNavigatorCardProps) {
  const percent = data.totalSteps > 0
    ? Math.min(100, Math.round((data.completedSteps / data.totalSteps) * 100))
    : 0

  return (
    <div className="chat-card chat-card--trace-nav">
      <h4 className="chat-card__title">Reasoning Trace</h4>
      <p className="chat-card__description">
        Progressive visibility into how agents reached the final recommendation.
      </p>
      <div className="chat-card__trace-progress">
        <div className="chat-card__trace-progress-bar">
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="chat-card__trace-progress-label">{data.completedSteps}/{data.totalSteps} steps</span>
      </div>
      <div className="chat-card__trace-step-list">
        {data.steps.slice(-4).map((step) => (
          <div key={`${step.stageId}-${step.summary}`} className="chat-card__trace-step">
            <span className="chat-card__trace-step-label">{step.stageLabel}</span>
            <span className="chat-card__trace-step-summary">{step.summary}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
