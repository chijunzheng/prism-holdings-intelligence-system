// SignalUpdateCard — notification when a watched signal has material changes.
// Shows what changed and offers "Re-analyze" or "Dismiss" actions.

import type { SignalUpdateData } from './types'

interface SignalUpdateCardProps {
  readonly data: SignalUpdateData
  readonly onFollowUp?: (query: string) => void
}

export function SignalUpdateCard({ data, onFollowUp }: SignalUpdateCardProps) {
  return (
    <div className="signal-update-card">
      <div className="signal-update-card__header">
        <span className="signal-update-card__icon">\u26A1</span>
        <span>Your watched signal has new information</span>
      </div>

      <h4 className="signal-update-card__headline">&ldquo;{data.headline}&rdquo;</h4>
      <p className="signal-update-card__meta">Watched since {data.watchedSince}</p>

      <div className="signal-update-card__changes">
        <h5>What changed:</h5>
        <ul>
          {data.changes.map((change, i) => (
            <li key={i}>{change}</li>
          ))}
        </ul>
      </div>

      <div className="signal-update-card__actions">
        <button
          type="button"
          className="analysis-report__btn-primary"
          onClick={() => onFollowUp?.(`Re-analyze "${data.headline}" — signal has updated`)}
        >
          Re-analyze
        </button>
        <button
          type="button"
          className="analysis-report__btn-secondary"
          onClick={() => onFollowUp?.(`Dismiss and unwatch "${data.headline}"`)}
        >
          Dismiss &amp; unwatch
        </button>
      </div>
    </div>
  )
}
