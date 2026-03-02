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
  return (
    <div className="sr__signal-item">
      <div className="sr__signal-item-header">
        <span className={`sr__sentiment-badge sr__sentiment-badge--${data.sentiment}`}>
          {sentimentLabel(data.sentiment)}
        </span>
        <span className="sr__signal-item-headline">{data.headline}</span>
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
        {data.signalId && onSignalAnalyze ? (
          <button
            className="sr__analyze-btn"
            onClick={() => onSignalAnalyze(data.signalId!)}
          >
            Analyze
          </button>
        ) : onFollowUp && (
          <button
            className="sr__analyze-btn"
            onClick={() => onFollowUp(`Tell me more about: ${data.headline}`)}
          >
            Tell me more
          </button>
        )}
      </div>
    </div>
  )
}
