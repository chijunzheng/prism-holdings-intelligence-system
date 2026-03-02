// ActionItemSection — concrete recommendation chip within a structured response.
// "Deep Dive ›" button triggers explore_ticker pipeline on the first ticker.

import type { ActionItemSection as ActionItemSectionData } from '@prism/shared'
import { renderMarkdown } from '../../chat/render-markdown'
import { TickerIcon } from '../../common/TickerIcon'

interface ActionItemSectionProps {
  readonly data: ActionItemSectionData
  readonly onFollowUp?: (query: string) => void
}

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  buy: { label: 'Buy', className: 'sr__action-item--buy' },
  sell: { label: 'Sell', className: 'sr__action-item--sell' },
  hold: { label: 'Hold', className: 'sr__action-item--hold' },
  rebalance: { label: 'Rebalance', className: 'sr__action-item--rebalance' },
  explore: { label: 'Explore', className: 'sr__action-item--explore' },
}

export function ActionItemSection({ data, onFollowUp }: ActionItemSectionProps) {
  const config = ACTION_CONFIG[data.action] ?? { label: data.action, className: '' }
  const prompt = data.actionPrompt ?? `Tell me more about: ${data.title}`
  const canDeepDive = onFollowUp !== undefined

  return (
    <div className={`sr__action-item ${config.className}`}>
      <div className="sr__action-item-header">
        <span className="sr__action-item-verb">{config.label}</span>
        <span className="sr__action-item-title">{renderMarkdown(data.title)}</span>
        {data.amount && <span className="sr__action-item-amount">{data.amount}</span>}
      </div>

      <div className="sr__action-item-body">{renderMarkdown(data.description)}</div>

      {data.tickers && data.tickers.length > 0 && (
        <div className="sr__action-item-tickers">
          {data.tickers.map((ticker) => (
            <span key={ticker} className="sr__ticker-chip">
              <TickerIcon ticker={ticker} size={18} />
              <span>{ticker}</span>
            </span>
          ))}
        </div>
      )}

      <div className="sr__action-item-footer">
        {onFollowUp && (
          <button
            className="sr__chip-btn"
            onClick={() => onFollowUp(prompt)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1C4.13 1 1 3.69 1 7c0 1.8 1.02 3.4 2.6 4.47L3 14l3.2-1.6c.58.1 1.18.16 1.8.16 3.87 0 7-2.69 7-6s-3.13-6-7-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Tell me more
          </button>
        )}
        {canDeepDive && (
          <button
            className="sr__chip-btn sr__chip-btn--primary"
            onClick={() => onFollowUp!(`Analyze the impact of: ${data.title}`)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Deep Dive
          </button>
        )}
      </div>
    </div>
  )
}
