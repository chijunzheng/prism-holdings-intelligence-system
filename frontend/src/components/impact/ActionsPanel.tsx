import type { TemporalAnalysis } from '../../types/graph'

interface ActionsPanelProps {
  readonly temporalAnalysis: TemporalAnalysis | null
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

export function ActionsPanel({ temporalAnalysis }: ActionsPanelProps) {
  if (!temporalAnalysis || temporalAnalysis.recommendations.length === 0) {
    return (
      <p className="actions-panel__empty">
        Select a signal to view recommended actions.
      </p>
    )
  }

  return (
    <div className="actions-panel">
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
        </article>
      ))}
    </div>
  )
}
