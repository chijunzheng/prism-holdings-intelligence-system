// SignalsPanel — Wealthsimple-style card rows showing detected market signals.
// Each card: headline + urgency/time metadata + tooltip + source links.

import type { Signal } from '@prism/shared'

interface SignalsPanelProps {
  readonly signals: readonly Signal[]
  readonly loading: boolean
  readonly onAnalyze: (signal: Signal) => void
}

const URGENCY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const URGENCY_COLORS: Record<string, string> = {
  critical: 'var(--color-negative, #d92b2b)',
  high: 'var(--color-ambiguous, #c87d15)',
  medium: 'var(--color-text-muted, #71717A)',
  low: 'var(--color-text-muted, #A1A1AA)',
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SkeletonCards() {
  return (
    <div className="signals-panel__skeleton">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="signals-panel__skeleton-card">
          <div className="signals-panel__skeleton-title" />
          <div className="signals-panel__skeleton-sub" />
        </div>
      ))}
    </div>
  )
}

function SignalCard({
  signal,
  onAnalyze,
}: {
  readonly signal: Signal
  readonly onAnalyze: (signal: Signal) => void
}) {
  const urgencyLabel = URGENCY_LABELS[signal.urgency] ?? signal.urgency
  const urgencyColor = URGENCY_COLORS[signal.urgency] ?? URGENCY_COLORS.medium
  const timeAgo = formatRelativeTime(signal.detectedAt)
  const sources = signal.sources.slice(0, 2)

  // Build native tooltip: description + affected exposures
  const tooltipParts = [
    signal.portfolioSummary || signal.description,
    signal.affectedExposures.length > 0
      ? `Affects: ${signal.affectedExposures.slice(0, 4).join(', ')}`
      : '',
  ].filter(Boolean)
  const tooltip = tooltipParts.join('\n')

  return (
    <li className="signals-panel__item">
      <button
        className="signals-panel__card"
        onClick={() => onAnalyze(signal)}
        type="button"
        title={tooltip}
      >
        <span className="signals-panel__headline">{signal.headline}</span>
        <span className="signals-panel__meta">
          <span className="signals-panel__urgency" style={{ color: urgencyColor }}>
            {urgencyLabel}
          </span>
          <span className="signals-panel__sep">&middot;</span>
          <span>{timeAgo}</span>
        </span>
        {sources.length > 0 && (
          <span className="signals-panel__sources">
            {sources.map((source, i) => (
              <a
                key={i}
                className="signals-panel__source-link"
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={source.title}
              >
                {source.publisher || new URL(source.url).hostname.replace('www.', '')}
              </a>
            ))}
          </span>
        )}
      </button>
    </li>
  )
}

export function SignalsPanel({ signals, loading, onAnalyze }: SignalsPanelProps) {
  if (loading) {
    return (
      <div className="signals-panel">
        <SkeletonCards />
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="signals-panel">
        <div className="signals-panel__empty">No active signals</div>
      </div>
    )
  }

  return (
    <div className="signals-panel">
      <ul className="signals-panel__list">
        {signals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} onAnalyze={onAnalyze} />
        ))}
      </ul>
    </div>
  )
}
