import type { Signal } from '@prism/shared'
import type { PortfolioNetImpactResponse, TemporalAnalysis } from '../../types/graph'

interface ImpactOverviewViewProps {
  readonly signals: ReadonlyArray<Signal>
  readonly materialSignalCount: number
  readonly selectedSignal: Signal | null
  readonly netImpactData: PortfolioNetImpactResponse | null
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly onOpenDrilldown: () => void
  readonly onOpenStrategyStudio: (seedSummary?: string) => void
}

function formatCad(value: number): string {
  const absolute = Math.abs(Math.round(value))
  const formatted = absolute.toLocaleString('en-CA')
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${formatted}`
}

export function ImpactOverviewView({
  signals,
  materialSignalCount,
  selectedSignal,
  netImpactData,
  temporalAnalysis,
  onOpenDrilldown,
  onOpenStrategyStudio,
}: ImpactOverviewViewProps) {
  const oneMonthImpact = netImpactData?.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact ?? 0
  const hasQuickActions = Boolean(temporalAnalysis?.recommendations.length)

  return (
    <div className="impact-overview">
      <header className="impact-overview__header">
        <h2>Portfolio Response Overview</h2>
        <p>
          Start with signal-level understanding, then move into Strategy Studio to design mitigation scenarios.
        </p>
      </header>

      <section className="impact-overview__cards" aria-label="Impact summary cards">
        <article className="impact-overview__card">
          <p className="impact-overview__kicker">Active Signals</p>
          <p className="impact-overview__value">{signals.length}</p>
          <p className="impact-overview__meta">{materialSignalCount} material (medium/high/critical)</p>
        </article>

        <article className="impact-overview__card">
          <p className="impact-overview__kicker">Net 1-Month Impact</p>
          <p className="impact-overview__value">{formatCad(oneMonthImpact)} CAD</p>
          <p className="impact-overview__meta">
            {netImpactData
              ? `${netImpactData.includedSignalCount}/${netImpactData.signalUniverseCount} signals in model`
              : 'Run total impact to populate this metric'}
          </p>
        </article>

        <article className="impact-overview__card">
          <p className="impact-overview__kicker">Current Focus</p>
          <p className="impact-overview__value impact-overview__value--headline">
            {selectedSignal?.headline ?? 'No signal selected'}
          </p>
          <p className="impact-overview__meta">
            {selectedSignal
              ? 'Use Drill-down for causal graph analysis of this signal.'
              : 'Select a signal in Drill-down mode first.'}
          </p>
        </article>
      </section>

      <section className="impact-overview__actions" aria-label="Primary actions">
        <button type="button" className="impact-overview__button" onClick={onOpenDrilldown}>
          Open Drill-down
        </button>
        <button
          type="button"
          className="impact-overview__button impact-overview__button--primary"
          onClick={() => onOpenStrategyStudio()}
        >
          Open Strategy Studio
        </button>
      </section>

      <section className="impact-overview__quick-actions" aria-label="Quick actions">
        <h3>Quick Actions</h3>
        {!hasQuickActions && (
          <p className="impact-overview__empty">Select a signal to generate quick actions and move into Strategy Studio.</p>
        )}
        {temporalAnalysis?.recommendations.slice(0, 3).map((recommendation) => (
          <article key={recommendation.id} className="impact-overview__quick-action-card">
            <p className="impact-overview__quick-action-summary">{recommendation.summary}</p>
            <p className="impact-overview__quick-action-meta">{recommendation.tradeoffs}</p>
            <button
              type="button"
              className="impact-overview__quick-action-btn"
              onClick={() => onOpenStrategyStudio(recommendation.summary)}
            >
              Open In Strategy Studio
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}
