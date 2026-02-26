import type { PortfolioNetSignalContribution, TemporalAnalysis } from '../../types/graph'

interface ActionsPanelProps {
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly mode?: 'signal' | 'portfolio'
  readonly signalContributions?: ReadonlyArray<PortfolioNetSignalContribution>
  readonly onDiscussAction?: (summary: string) => void
  readonly onOpenStrategyStudio?: (summary: string) => void
}

const HORIZON_LABELS: Record<string, string> = {
  one_week: '1 Week',
  one_month: '1 Month',
  six_month: '6 Months',
}

function formatCad(value: number): string {
  const abs = Math.abs(value)
  const formatted = abs >= 1000
    ? `$${(abs / 1000).toFixed(1)}K`
    : `$${abs.toFixed(0)}`
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

function directionLabel(direction: PortfolioNetSignalContribution['direction']): string {
  if (direction === 'positive') return 'positive'
  if (direction === 'negative') return 'negative'
  return 'mixed'
}

export function ActionsPanel({
  temporalAnalysis,
  mode = 'signal',
  signalContributions,
  onDiscussAction,
  onOpenStrategyStudio,
}: ActionsPanelProps) {
  if (!temporalAnalysis || temporalAnalysis.recommendations.length === 0) {
    return (
      <p className="actions-panel__empty">
        {mode === 'portfolio'
          ? 'Total impact recommendations are unavailable right now.'
          : 'Select a signal to view recommended quick actions.'}
      </p>
    )
  }

  return (
    <div className="actions-panel">
      {mode === 'portfolio' && signalContributions && signalContributions.length > 0 && (
        <article className="actions-panel__contributions">
          <p className="actions-panel__contributions-title">Total impact includes these signals</p>
          <ul className="actions-panel__contributions-list">
            {signalContributions.map((contribution) => (
              <li key={contribution.signalId} className="actions-panel__contribution-item">
                <span className="actions-panel__contribution-headline">{contribution.headline}</span>
                <span className="actions-panel__contribution-meta">
                  {Math.round(contribution.normalizedWeight * 100)}% weight · {directionLabel(contribution.direction)} · 1M {formatCad(contribution.oneMonthImpactCad)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}
      {temporalAnalysis.recommendations.map((rec) => (
        <article key={rec.id} className="actions-panel__item">
          <span className="actions-panel__horizon">
            {HORIZON_LABELS[rec.horizon] ?? rec.horizon}
          </span>
          <p className="actions-panel__summary">{rec.summary}</p>
          <p className="actions-panel__rationale">{rec.rationale}</p>
          {rec.tradeoffs && (
            <p className="actions-panel__tradeoffs">{rec.tradeoffs}</p>
          )}
          {rec.proposedShiftCad !== 0 && (
            <p className="actions-panel__shift">
              Proposed shift: {formatCad(rec.proposedShiftCad)} CAD
            </p>
          )}
          <div className="actions-panel__buttons">
            {onDiscussAction && (
              <button
                type="button"
                className="actions-panel__button"
                onClick={() => onDiscussAction(rec.summary)}
              >
                Discuss In Prism
              </button>
            )}
            {onOpenStrategyStudio && (
              <button
                type="button"
                className="actions-panel__button actions-panel__button--primary"
                onClick={() => onOpenStrategyStudio(rec.summary)}
              >
                Open In Strategy Studio
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
