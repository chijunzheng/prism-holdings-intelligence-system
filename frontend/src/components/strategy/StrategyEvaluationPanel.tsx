import type { StrategyEvaluation } from '../../types/graph'

interface StrategyEvaluationPanelProps {
  readonly evaluation: StrategyEvaluation | null
  readonly riskCapPct: number
  readonly draftReason: string | null
}

function formatCad(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-CA')}`
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export function StrategyEvaluationPanel({ evaluation, riskCapPct, draftReason }: StrategyEvaluationPanelProps) {
  return (
    <section className="strategy-eval" aria-label="Strategy evaluation panel">
      <header className="strategy-eval__header">
        <h3>Evaluation</h3>
        <p>Objective: minimize 1-month downside while preserving 6-month guardrail.</p>
      </header>

      {draftReason && (
        <p className="strategy-eval__draft-reason">Draft source: {draftReason}</p>
      )}

      {!evaluation && (
        <p className="strategy-eval__empty">Run evaluation after adding scenario positions.</p>
      )}

      {evaluation && (
        <>
          <dl className="strategy-eval__metrics">
            <div className="strategy-eval__metric">
              <dt>Baseline (1M)</dt>
              <dd>{formatCad(evaluation.baselineOneMonthCad)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Proposed (1M)</dt>
              <dd>{formatCad(evaluation.proposedOneMonthCad)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Downside reduction</dt>
              <dd>{formatCad(evaluation.downsideReductionCad)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Diversification gain</dt>
              <dd>{evaluation.diversificationGain.toFixed(2)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Turnover</dt>
              <dd>{formatPct(evaluation.turnoverPct)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Tax penalty</dt>
              <dd>{formatCad(evaluation.taxPenaltyCad)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Composite score</dt>
              <dd>{evaluation.score.toFixed(2)}</dd>
            </div>
            <div className="strategy-eval__metric">
              <dt>Objective</dt>
              <dd>{evaluation.objectiveSatisfied ? 'Pass' : 'Needs Revision'}</dd>
            </div>
          </dl>
          {evaluation.warnings.length > 0 && (
            <ul className="strategy-eval__warnings">
              {evaluation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="strategy-eval__constraints">
        <h4>Constraints</h4>
        <ul>
          <li>Risk-profile turnover cap: {formatPct(riskCapPct)}</li>
          <li>Hard turnover override max: 10.0% (explicit user command)</li>
          <li>Universe includes ETFs + large-cap stocks, excludes microcaps</li>
          <li>Tax-aware mode prioritizes registered account changes</li>
        </ul>
      </div>
    </section>
  )
}
