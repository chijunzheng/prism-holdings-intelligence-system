import type { StrategyEvaluation } from '@prism/shared'

interface PlanSelection {
  readonly candidateId: string
  readonly ticker: string
  readonly name: string
  readonly allocationPct: number
}

interface PlanConfirmationProps {
  readonly selections: ReadonlyArray<PlanSelection>
  readonly evaluation: StrategyEvaluation | null
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

export function PlanConfirmation({ selections, evaluation, onConfirm, onCancel }: PlanConfirmationProps) {
  return (
    <div className="plan-confirm-overlay" onClick={onCancel}>
      <div className="plan-confirm" onClick={(e) => e.stopPropagation()}>
        <h2 className="plan-confirm__title">Plan Summary</h2>

        <div className="plan-confirm__warning">
          Prism does not execute trades. This plan is for informational purposes only.
          Always consult a qualified financial advisor before making investment decisions.
        </div>

        <div className="plan-confirm__selections">
          <h3 className="plan-confirm__subtitle">Selected Candidates</h3>
          {selections.map((s) => (
            <div key={s.candidateId} className="plan-confirm__selection-row">
              <span className="plan-confirm__selection-ticker">{s.ticker}</span>
              <span className="plan-confirm__selection-name">{s.name}</span>
              <span className="plan-confirm__selection-alloc">{s.allocationPct}%</span>
            </div>
          ))}
        </div>

        {evaluation && (
          <div className="plan-confirm__eval">
            <h3 className="plan-confirm__subtitle">Evaluation</h3>
            <div className="plan-confirm__eval-row">
              <span>Downside reduction</span>
              <span>{formatDollar(evaluation.downsideReductionCad)}</span>
            </div>
            <div className="plan-confirm__eval-row">
              <span>Turnover</span>
              <span>{evaluation.turnoverPct.toFixed(1)}%</span>
            </div>
            <div className="plan-confirm__eval-row">
              <span>Tax impact</span>
              <span>~{formatDollar(evaluation.taxPenaltyCad)}</span>
            </div>
          </div>
        )}

        <div className="plan-confirm__actions">
          <button type="button" className="plan-confirm__btn plan-confirm__btn--secondary" onClick={onCancel}>
            Go back
          </button>
          <button type="button" className="plan-confirm__btn plan-confirm__btn--primary" onClick={onConfirm}>
            I understand
          </button>
        </div>
      </div>
    </div>
  )
}
