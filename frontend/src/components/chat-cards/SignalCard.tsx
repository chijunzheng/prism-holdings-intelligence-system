// SignalCard — new signal notification with urgency, sentiment, and action buttons.

import type { Signal } from '@prism/shared'

interface SignalCardProps {
  readonly data: unknown
  readonly onAnalyze?: (signalId: string) => void
}

const URGENCY_COLORS: Record<string, string> = {
  high: 'var(--color-negative, #d92b2b)',
  moderate: 'var(--color-ambiguous, #c87d15)',
  low: 'var(--color-positive, #0da750)',
}

export function SignalCard({ data, onAnalyze }: SignalCardProps) {
  const signal = data as Signal

  return (
    <div className="chat-card chat-card--signal">
      <div className="chat-card__header">
        <span
          className="chat-card__urgency"
          style={{ color: URGENCY_COLORS[signal.urgency] ?? '#737373' }}
        >
          {signal.urgency.toUpperCase()}
        </span>
        <span className="chat-card__sentiment">{signal.sentiment}</span>
      </div>
      <h4 className="chat-card__title">{signal.headline}</h4>
      <p className="chat-card__description">{signal.description}</p>
      <div className="chat-card__exposures">
        {signal.affectedExposures.map((exp) => (
          <span key={exp} className="chat-card__exposure-chip">{exp}</span>
        ))}
      </div>
      <div className="chat-card__actions">
        <button
          className="chat-card__btn chat-card__btn--primary"
          onClick={() => onAnalyze?.(signal.id)}
        >
          Analyze Impact
        </button>
        <button className="chat-card__btn chat-card__btn--secondary">
          Dismiss
        </button>
      </div>
    </div>
  )
}
