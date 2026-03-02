// VerdictSummaryCard — the TL;DR that appears first after pipeline completes.
// Shows net impact, affected holding count, direction, and confidence.

import type { VerdictSummaryData } from './types'

function formatCad(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`
}

interface VerdictSummaryCardProps {
  readonly data: VerdictSummaryData
  readonly onFollowUp?: (query: string) => void
}

export function VerdictSummaryCard({ data, onFollowUp }: VerdictSummaryCardProps) {
  const { netImpact, holdingCount, direction, confidence, signalHeadline } = data

  return (
    <div className="chat-card verdict-summary">
      <div className="verdict-summary__impact">
        <span
          className={`verdict-summary__amount verdict-summary__amount--${netImpact < 0 ? 'negative' : 'positive'}`}
        >
          {formatCad(netImpact)}
        </span>
        <span className="verdict-summary__period">estimated 1M impact</span>
      </div>
      <p className="verdict-summary__detail">
        Across {holdingCount} holding{holdingCount !== 1 ? 's' : ''}, driven by{' '}
        {signalHeadline.toLowerCase()}
      </p>
      <div className="verdict-summary__meta">
        <span
          className={`verdict-summary__direction verdict-summary__direction--${direction}`}
        >
          {direction.charAt(0).toUpperCase() + direction.slice(1)}
        </span>
        <span className="verdict-summary__confidence">
          {confidence}% confidence
        </span>
      </div>
      {onFollowUp && (
        <div className="verdict-summary__actions">
          <button
            type="button"
            className="chat-card__btn chat-card__btn--secondary"
            onClick={() => onFollowUp('What exactly drives this impact?')}
          >
            What drives this?
          </button>
        </div>
      )}
    </div>
  )
}
