import type { Signal } from '@prism/shared'
import type { Materiality } from './signal-utils'
import { SignalBadge } from './SignalBadge'

interface InAppNotificationProps {
  readonly signal: Signal | null
  readonly materiality: Materiality
  readonly onDismiss: () => void
  readonly onOpenAnalysis: (signal: Signal) => void
}

export function InAppNotification({
  signal,
  materiality,
  onDismiss,
  onOpenAnalysis,
}: InAppNotificationProps) {
  if (!signal) return null

  return (
    <aside className={`in-app-notification in-app-notification--${materiality}`}>
      <div className="in-app-notification__content">
        <span className="in-app-notification__label">New high-priority signal</span>
        <p className="in-app-notification__headline">{signal.headline}</p>
        <div className="in-app-notification__meta">
          <SignalBadge classification={signal.temporalClassification} />
        </div>
      </div>

      <div className="in-app-notification__actions">
        <button
          type="button"
          className="in-app-notification__button"
          onClick={() => onOpenAnalysis(signal)}
        >
          View
        </button>
        <button type="button" className="in-app-notification__close" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </aside>
  )
}
