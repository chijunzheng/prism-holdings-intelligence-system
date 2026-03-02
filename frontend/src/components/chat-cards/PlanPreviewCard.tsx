// PlanPreviewCard — shows before/after portfolio comparison from candidate adjustments.

import type { PlanPreview } from '@prism/shared'

interface PlanPreviewCardProps {
  readonly data: PlanPreview
}

export function PlanPreviewCard({ data }: PlanPreviewCardProps) {
  const scoreImproved = data.diversificationScoreChange.after > data.diversificationScoreChange.before
  const scoreUnchanged = data.diversificationScoreChange.after === data.diversificationScoreChange.before

  return (
    <div className="chat-card chat-card--plan-preview">
      <h4 className="chat-card__title">Plan Impact Preview</h4>
      <p className="chat-card__description">
        Applying {data.candidateCount} planned change{data.candidateCount !== 1 ? 's' : ''} to your portfolio.
      </p>

      <div className="chat-card__preview-grid">
        <div className="chat-card__preview-column">
          <h5 className="chat-card__preview-heading">Current</h5>
          {data.currentAllocation.map((entry) => (
            <div key={entry.category} className="chat-card__preview-row">
              <span>{entry.category}</span>
              <span className="chat-card__preview-pct">{entry.pct}%</span>
            </div>
          ))}
        </div>

        <div className="chat-card__preview-arrow">→</div>

        <div className="chat-card__preview-column">
          <h5 className="chat-card__preview-heading">Projected</h5>
          {data.projectedAllocation.map((entry) => {
            const current = data.currentAllocation.find((c) => c.category === entry.category)
            const delta = entry.pct - (current?.pct ?? 0)
            return (
              <div key={entry.category} className="chat-card__preview-row">
                <span>{entry.category}</span>
                <span className="chat-card__preview-pct">
                  {entry.pct}%
                  {delta !== 0 && (
                    <span className={`chat-card__preview-delta ${delta > 0 ? 'chat-card__preview-delta--up' : 'chat-card__preview-delta--down'}`}>
                      {delta > 0 ? '+' : ''}{delta}%
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="chat-card__preview-summary">
        <div className="chat-card__preview-stat">
          <span className="chat-card__preview-stat-label">Diversification</span>
          <span className={`chat-card__preview-stat-value ${scoreImproved ? 'chat-card__preview-stat-value--positive' : scoreUnchanged ? '' : 'chat-card__preview-stat-value--negative'}`}>
            {data.diversificationScoreChange.before} → {data.diversificationScoreChange.after} asset types
          </span>
        </div>
        <div className="chat-card__preview-stat">
          <span className="chat-card__preview-stat-label">Est. risk reduction</span>
          <span className="chat-card__preview-stat-value">{data.riskReductionEstimate}</span>
        </div>
        <div className="chat-card__preview-stat">
          <span className="chat-card__preview-stat-label">Est. transaction cost</span>
          <span className="chat-card__preview-stat-value">{data.estimatedTransactionCost}</span>
        </div>
      </div>
    </div>
  )
}
