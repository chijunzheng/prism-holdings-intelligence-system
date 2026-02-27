import type { Signal } from '@prism/shared'
import { getMateriality } from '../portfolio/signal-utils'

interface SignalListItemProps {
  readonly signal: Signal
  readonly active: boolean
  readonly onClick: () => void
}

function formatImpactShort(signal: Signal): { text: string; negative: boolean } {
  const materiality = getMateriality(signal)
  const isNegative = !/positive|bullish|gain|rally|growth/i.test(signal.headline + ' ' + signal.description)
  const label = materiality === 'high' ? 'High' : materiality === 'medium' ? 'Med' : 'Low'
  return { text: `${label} impact`, negative: isNegative }
}

function formatTimeAgo(isoDate: string): string {
  const ms = Date.now() - Date.parse(isoDate)
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SignalListItem({ signal, active, onClick }: SignalListItemProps) {
  const impact = formatImpactShort(signal)

  return (
    <button
      type="button"
      className={`signal-list-item${active ? ' signal-list-item--active' : ''}`}
      onClick={onClick}
    >
      <span className={`signal-list-item__dot signal-list-item__dot--${signal.urgency}`} />
      <span className="signal-list-item__content">
        <span className="signal-list-item__headline">{signal.headline}</span>
        <span className="signal-list-item__meta">
          <span className={impact.negative ? 'signal-list-item__impact--negative' : 'signal-list-item__impact--positive'}>
            {impact.text}
          </span>
          <span>{formatTimeAgo(signal.detectedAt)}</span>
        </span>
      </span>
    </button>
  )
}
