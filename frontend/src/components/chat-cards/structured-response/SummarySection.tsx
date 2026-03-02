import type { SummarySection as SummarySectionData } from '@prism/shared'
import { renderMarkdown } from '../../chat/render-markdown'

interface SummarySectionProps {
  readonly data: SummarySectionData
}

function sentimentClass(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'sr__summary--positive'
    case 'negative': return 'sr__summary--negative'
    case 'mixed': return 'sr__summary--mixed'
    default: return 'sr__summary--neutral'
  }
}

function statSentimentClass(sentiment?: string): string {
  if (!sentiment) return ''
  switch (sentiment) {
    case 'positive': return 'sr__stat-pill--positive'
    case 'negative': return 'sr__stat-pill--negative'
    default: return ''
  }
}

export function SummarySection({ data }: SummarySectionProps) {
  return (
    <div className={`sr__summary ${sentimentClass(data.sentiment)}`}>
      <p className="sr__summary-headline">{data.headline}</p>
      {data.body && (
        <div className="sr__summary-body">{renderMarkdown(data.body)}</div>
      )}
      {data.stats && data.stats.length > 0 && (
        <div className="sr__stat-pills">
          {data.stats.map((stat) => (
            <span
              key={stat.label}
              className={`sr__stat-pill ${statSentimentClass(stat.sentiment)}`}
            >
              <span className="sr__stat-pill-label">{stat.label}</span>
              <span className="sr__stat-pill-value">{stat.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
