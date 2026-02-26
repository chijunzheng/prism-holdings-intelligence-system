import type { Signal } from '@prism/shared'

interface SignalCardProps {
  readonly signal: Signal
  readonly selected: boolean
  readonly onSelect: (signalId: string) => void
}

function extractReadableDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    // Filter out Google infrastructure domains
    if (hostname.includes('vertexaisearch') || hostname.includes('googleapis')) {
      return 'Market Signal'
    }
    return hostname
  } catch {
    return 'Market Signal'
  }
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
        {source?.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="impact-signal-card__source-link"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open source: ${source.title}`}
          >
            {source.publisher && !source.publisher.includes('vertexaisearch')
              ? source.publisher
              : extractReadableDomain(source.url)}
            {' '}&#8599;
          </a>
        ) : (
          source?.publisher ?? 'Market Signal'
        )}
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
