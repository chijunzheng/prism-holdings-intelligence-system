// SignalsPanel — compact sidebar section showing detected market signals.
// Each row: urgency dot + headline. Click triggers pipeline analysis in chat.

import type { Signal } from '@prism/shared'

interface SignalsPanelProps {
  readonly signals: readonly Signal[]
  readonly loading: boolean
  readonly onAnalyze: (signal: Signal) => void
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#DC2626',
  medium: '#D97706',
  low: '#16A34A',
}

export function SignalsPanel({ signals, loading, onAnalyze }: SignalsPanelProps) {
  if (loading) {
    return (
      <div className="signals-panel">
        <h3 className="signals-panel__title">Signals</h3>
        <div className="signals-panel__loading">Scanning markets...</div>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="signals-panel">
        <h3 className="signals-panel__title">Signals</h3>
        <div className="signals-panel__empty">No active signals</div>
      </div>
    )
  }

  return (
    <div className="signals-panel">
      <div className="signals-panel__header">
        <h3 className="signals-panel__title">Signals</h3>
        <span className="signals-panel__count">{signals.length}</span>
      </div>
      <ul className="signals-panel__list">
        {signals.map((signal) => (
          <li key={signal.id} className="signals-panel__item">
            <button
              className="signals-panel__row"
              onClick={() => onAnalyze(signal)}
              type="button"
            >
              <span
                className="signals-panel__dot"
                style={{ backgroundColor: URGENCY_COLORS[signal.urgency] ?? '#71717A' }}
              />
              <span className="signals-panel__headline">{signal.headline}</span>
              <span className="signals-panel__action">Analyze</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
