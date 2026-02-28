// PortfolioReviewCard — cross-signal net vs gross impact comparison.

import type { PortfolioVerdict } from '@prism/shared'

interface PortfolioReviewCardProps {
  readonly data: unknown
}

function formatDollar(n: number): string {
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toLocaleString()}`
}

export function PortfolioReviewCard({ data }: PortfolioReviewCardProps) {
  const verdict = data as PortfolioVerdict

  const savings = Math.abs(verdict.portfolioGrossImpact.mid) - Math.abs(verdict.portfolioNetImpact.mid)

  return (
    <div className="chat-card chat-card--portfolio-review">
      <h4 className="chat-card__title">Portfolio Review</h4>

      <div className="chat-card__impact-comparison">
        <div className="chat-card__impact-row chat-card__impact-row--gross">
          <span className="chat-card__impact-label">Gross impact (naive sum)</span>
          <span className="chat-card__impact-value">{formatDollar(verdict.portfolioGrossImpact.mid)}</span>
        </div>
        <div className="chat-card__impact-row chat-card__impact-row--net">
          <span className="chat-card__impact-label">Net impact (with interactions)</span>
          <span className="chat-card__impact-value chat-card__impact-value--highlight">
            {formatDollar(verdict.portfolioNetImpact.mid)}
          </span>
        </div>
        {savings > 0 && (
          <div className="chat-card__savings">
            Interactions save ~${savings.toLocaleString()} vs naive sum
          </div>
        )}
      </div>

      <p className="chat-card__interaction-summary">{verdict.interactionSummary}</p>

      {verdict.keyInsights.length > 0 && (
        <div className="chat-card__insights">
          <h5>Key Insights</h5>
          <ul>
            {verdict.keyInsights.map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
        </div>
      )}

      <div className="chat-card__signal-breakdown">
        <h5>Per-Signal Breakdown</h5>
        {verdict.signals.map((s) => {
          const impact1M = s.individualVerdict.holdingImpacts
            .map((h) => h.impact['1M']?.mid ?? 0)
            .reduce((sum, v) => sum + v, 0)
          return (
            <div key={s.signalId} className="chat-card__signal-row">
              <span className="chat-card__signal-headline">{s.headline}</span>
              <span className="chat-card__signal-impact">{formatDollar(impact1M)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
