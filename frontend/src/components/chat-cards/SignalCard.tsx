// SignalCard — rich signal card with urgency badge, sentiment, exposure chips, and action.
// When onAnalyze is undefined, renders as read-only (no click handler, no "Analyze Impact" button).

import type { Signal } from '@prism/shared'

interface SignalCardProps {
  readonly data: unknown
  readonly onAnalyze?: (signalId: string) => void
}

const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: 'CRITICAL', className: 'signal-card__badge--critical' },
  high: { label: 'HIGH', className: 'signal-card__badge--high' },
  medium: { label: 'MEDIUM', className: 'signal-card__badge--medium' },
  low: { label: 'LOW', className: 'signal-card__badge--low' },
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positive',
  negative: 'Negative',
  mixed: 'Mixed',
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays}d ago`
}

export function SignalCard({ data, onAnalyze }: SignalCardProps) {
  const signal = data as Signal
  const urgency = URGENCY_CONFIG[signal.urgency] ?? { label: signal.urgency.toUpperCase(), className: '' }
  const sentiment = SENTIMENT_LABELS[signal.sentiment] ?? signal.sentiment
  const timeAgo = formatTimeAgo(signal.detectedAt)
  const isInteractive = onAnalyze !== undefined

  return (
    <div
      className={`signal-card${isInteractive ? '' : ' signal-card--readonly'}`}
      onClick={isInteractive ? () => onAnalyze(signal.id) : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter') onAnalyze(signal.id) } : undefined}
    >
      <div className="signal-card__top">
        <span className={`signal-card__badge ${urgency.className}`}>{urgency.label}</span>
        <span className="signal-card__sentiment">{sentiment}</span>
        <span className="signal-card__time">{timeAgo}</span>
      </div>

      <h4 className="signal-card__headline">{signal.headline}</h4>
      <p className="signal-card__description">{signal.description}</p>

      <div className="signal-card__exposures">
        {signal.affectedExposures.slice(0, 4).map((exp) => (
          <span key={exp} className="signal-card__chip">{exp}</span>
        ))}
        {signal.affectedExposures.length > 4 && (
          <span className="signal-card__chip signal-card__chip--more">
            +{signal.affectedExposures.length - 4}
          </span>
        )}
      </div>

      {signal.sources.length > 0 && (
        <div className="signal-card__sources">
          {signal.sources.slice(0, 2).map((src, i) => (
            <a
              key={i}
              className="signal-card__source-link"
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {src.title}
            </a>
          ))}
        </div>
      )}

      {isInteractive && (
        <div className="signal-card__footer">
          <button
            className="signal-card__analyze-btn"
            onClick={(e) => {
              e.stopPropagation()
              onAnalyze(signal.id)
            }}
          >
            Analyze Impact
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
