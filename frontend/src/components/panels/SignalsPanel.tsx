// SignalsPanel — Wealthsimple-style card rows showing detected market signals.
// Each card: headline + urgency/time metadata. Click triggers pipeline analysis.

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

export function SignalsPanel({ signals, loading, onAnalyze }: SignalsPanelProps) {
  if (loading) {
    return (
      <div className="signals-panel">
        <h3 className="signals-panel__title">Market Signals</h3>
        <SkeletonCards />
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="signals-panel">
        <h3 className="signals-panel__title">Market Signals</h3>
        <div className="signals-panel__empty">No active signals</div>
      </div>
    )
  }

  return (
    <div className="signals-panel">
      <div className="signals-panel__header">
        <h3 className="signals-panel__title">Market Signals</h3>
      </div>
      <ul className="signals-panel__list">
        {signals.map((signal) => {
          const urgencyLabel = URGENCY_LABELS[signal.urgency] ?? signal.urgency
          const timeAgo = formatRelativeTime(signal.detectedAt)

          return (
            <li key={signal.id} className="signals-panel__item">
              <button
                className="signals-panel__card"
                onClick={() => onAnalyze(signal)}
                type="button"
              >
                <span className="signals-panel__headline">{signal.headline}</span>
                <span className="signals-panel__meta">
                  {urgencyLabel} &middot; {timeAgo}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
