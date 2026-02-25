import type { Signal } from '@prism/shared'

interface SignalCardProps {
  readonly signal: Signal
  readonly selected: boolean
  readonly onSelect: (signalId: string) => void
}

function formatTimeAgo(dateString: string): string {
  const diffMs = Date.now() - Date.parse(dateString)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return days === 1 ? '1d ago' : `${days}d ago`
}

export function SignalCard({ signal, selected, onSelect }: SignalCardProps) {
  const source = signal.sources[0]

  return (
    <button
      type="button"
      className={`impact-signal-card ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(signal.id)}
      aria-pressed={selected}
    >
      <span className="impact-signal-card__source">
        {source?.publisher ?? 'Market Signal'}
        <span className="impact-signal-card__time">
          {formatTimeAgo(signal.detectedAt)}
        </span>
      </span>
      <span className="impact-signal-card__headline">{signal.headline}</span>
      <span className={`impact-signal-card__badge impact-signal-card__badge--${signal.temporalClassification}`}>
        {signal.temporalClassification}
      </span>
    </button>
  )
}
