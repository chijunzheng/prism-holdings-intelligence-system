import type { SignalItemSection as SignalItemSectionData } from '@prism/shared'
import { renderMarkdown } from '../../chat/render-markdown'
import { TickerIcon } from '../../common/TickerIcon'

interface SignalItemSectionProps {
  readonly data: SignalItemSectionData
  readonly onSignalAnalyze?: (signalId: string) => void
  readonly onFollowUp?: (query: string) => void
}

function sentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'Positive'
    case 'negative': return 'Negative'
    case 'mixed': return 'Mixed'
    default: return 'Neutral'
  }
}

export function SignalItemSection({ data, onSignalAnalyze, onFollowUp }: SignalItemSectionProps) {
  const handleDeepDive = data.signalId && onSignalAnalyze
    ? () => onSignalAnalyze(data.signalId!)
    : onFollowUp
      ? () => onFollowUp(`Analyze the impact of: ${data.headline}`)
      : undefined

  return (
    <div className="sr__signal-item">
      <div className="sr__signal-item-header">
        <span className={`sr__sentiment-badge sr__sentiment-badge--${data.sentiment}`}>
          {sentimentLabel(data.sentiment)}
        </span>
        <span className="sr__signal-item-headline">{renderMarkdown(data.headline)}</span>
      </div>

      <div className="sr__signal-item-body">{renderMarkdown(data.body)}</div>

      {data.tickers && data.tickers.length > 0 && (
        <div className="sr__ticker-chips">
          {data.tickers.map((ticker) => (
            <span key={ticker} className="sr__ticker-chip">
              <TickerIcon ticker={ticker} size={18} />
              <span>{ticker}</span>
            </span>
          ))}
          {data.exposureAmount && (
            <span className="sr__exposure-amount">{data.exposureAmount}</span>
          )}
        </div>
      )}

      <div className="sr__signal-item-footer">
        {data.sourceTitle && data.sourceUrl && (
          <a
            className="sr__source-link"
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {data.sourceTitle}
          </a>
        )}
        <div className="sr__signal-item-actions">
          {onFollowUp && (
            <button
              className="sr__chip-btn"
              onClick={() => onFollowUp(`Tell me more about: ${data.headline}`)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C4.13 1 1 3.69 1 7c0 1.8 1.02 3.4 2.6 4.47L3 14l3.2-1.6c.58.1 1.18.16 1.8.16 3.87 0 7-2.69 7-6s-3.13-6-7-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              Tell me more
            </button>
          )}
          {handleDeepDive && (
            <button
              className="sr__chip-btn sr__chip-btn--primary"
              onClick={handleDeepDive}
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
    </div>
  )
}
