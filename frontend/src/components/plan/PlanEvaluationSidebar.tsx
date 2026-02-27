import type { StrategyDraft, StrategyEvaluation } from '@prism/shared'
import { ConstraintRow } from './ConstraintRow'

interface PlanEvaluationSidebarProps {
  readonly evaluation: StrategyEvaluation | null
  readonly draft: StrategyDraft | null
  readonly evaluating: boolean
  readonly selectionCount: number
  readonly onReview: () => void
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : amount > 0 ? '+' : ''
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

export function PlanEvaluationSidebar({
  evaluation,
  draft,
  evaluating,
  selectionCount,
  onReview,
}: PlanEvaluationSidebarProps) {
  const hasSelections = selectionCount > 0

  return (
    <aside className="plan-sidebar">
      <div className="plan-sidebar__card">
        <h3 className="plan-sidebar__title">Plan Evaluation</h3>

        {evaluating && (
          <p className="plan-sidebar__evaluating">Evaluating...</p>
        )}

        {!hasSelections && !evaluating && (
          <p className="plan-sidebar__empty">Add candidates to see evaluation</p>
        )}

        {evaluation && !evaluating && (
          <>
            {/* Before / After */}
            <div className="plan-sidebar__impact">
              <div className="plan-sidebar__impact-row">
                <span className="plan-sidebar__impact-label">1M impact (before)</span>
                <span className="plan-sidebar__impact-value">
                  {formatDollar(evaluation.baselineOneMonthCad)}
                </span>
              </div>
              <div className="plan-sidebar__impact-row">
                <span className="plan-sidebar__impact-label">1M impact (after)</span>
                <span className="plan-sidebar__impact-value plan-sidebar__impact-value--improved">
                  {formatDollar(evaluation.proposedOneMonthCad)}
                </span>
              </div>
              <div className="plan-sidebar__impact-row plan-sidebar__impact-row--highlight">
                <span className="plan-sidebar__impact-label">Downside reduction</span>
                <span className="plan-sidebar__impact-value plan-sidebar__impact-value--improved">
                  {formatDollar(evaluation.downsideReductionCad)}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="plan-sidebar__metrics">
              <div className="plan-sidebar__metric-row">
                <span>Turnover</span>
                <span>{evaluation.turnoverPct.toFixed(1)}%</span>
              </div>
              <div className="plan-sidebar__metric-row">
                <span>Tax impact</span>
                <span>~{formatDollar(evaluation.taxPenaltyCad)}</span>
              </div>
              <div className="plan-sidebar__metric-row">
                <span>Diversification gain</span>
                <span>+{evaluation.diversificationGain.toFixed(2)}</span>
              </div>
            </div>

            {/* Constraints */}
            <div className="plan-sidebar__constraints">
              <p className="plan-sidebar__constraints-title">Constraints</p>
              <ConstraintRow
                label={`Turnover cap (${evaluation.turnoverCapPct}%)`}
                pass={evaluation.turnoverPct <= evaluation.turnoverCapPct}
              />
              <ConstraintRow
                label={`Max new positions (${draft?.constraints.maxNewPositions ?? 2})`}
                pass={selectionCount <= (draft?.constraints.maxNewPositions ?? 2)}
              />
              <ConstraintRow
                label="6M guardrail"
                pass={evaluation.sixMonthGuardrailDeltaCad >= 0}
              />
            </div>

            {evaluation.warnings.length > 0 && (
              <div className="plan-sidebar__warnings">
                {evaluation.warnings.map((w, i) => (
                  <p key={i} className="plan-sidebar__warning">{w}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {hasSelections && (
        <button
          type="button"
          className="plan-sidebar__review-btn"
          onClick={onReview}
          disabled={evaluating}
        >
          Review plan summary &rarr;
        </button>
      )}
    </aside>
  )
}
