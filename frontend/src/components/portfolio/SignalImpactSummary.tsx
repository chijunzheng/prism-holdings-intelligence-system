import { useMemo } from 'react'
import type { Signal, ExposureMap, HealthScore } from '@prism/shared'
import type { PortfolioNetImpactResponse } from '../../types/graph'
import {
  computeHoldingImpacts,
  computePortfolioSummary,
  formatImpact,
} from './signal-impact-utils'

interface SignalImpactSummaryProps {
  readonly signals: ReadonlyArray<Signal>
  readonly exposureMap: ExposureMap | null
  readonly totalPortfolioValue: number
  readonly netImpact?: PortfolioNetImpactResponse | null
  readonly healthScore: HealthScore | null
  readonly onDiscussWithPrism: () => void
}

function getGradeColor(grade: string): string {
  if (grade === 'A' || grade === 'A+' || grade === 'A-') return 'var(--color-positive)'
  if (grade === 'B' || grade === 'B+' || grade === 'B-') return 'var(--color-ambiguous)'
  return 'var(--color-negative)'
}

export function SignalImpactSummary({
  signals,
  exposureMap,
  totalPortfolioValue,
  netImpact,
  healthScore,
  onDiscussWithPrism,
}: SignalImpactSummaryProps) {
  const summary = useMemo(() => {
    if (!exposureMap || signals.length === 0 || totalPortfolioValue === 0) return null
    const holdingImpacts = computeHoldingImpacts(signals, exposureMap, totalPortfolioValue)
    const localSummary = computePortfolioSummary(signals, exposureMap, totalPortfolioValue, holdingImpacts)
    if (!netImpact) return localSummary

    return {
      ...localSummary,
      netDollarImpact: netImpact.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact,
      activeSignalCount: netImpact.includedSignalCount,
    }
  }, [exposureMap, netImpact, signals, totalPortfolioValue])

  const hasSignals = signals.length > 0 && summary

  return (
    <section className="signal-impact-summary-section">
      <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>Signal Impact Summary</h2>

      {hasSignals ? (
        <div className="signal-impact-summary">
          <div className="signal-impact-summary__stats">
            <div className="signal-impact-summary__stat">
              <span className={`signal-impact-summary__stat-value ${summary.netDollarImpact < -10 ? 'signal-impact-summary__stat-value--negative' : summary.netDollarImpact > 10 ? 'signal-impact-summary__stat-value--positive' : ''}`}>
                {formatImpact(summary.netDollarImpact)}
              </span>
              <span className="signal-impact-summary__stat-label">Net Impact</span>
            </div>
            <div className="signal-impact-summary__stat-divider" />
            <div className="signal-impact-summary__stat">
              <span className="signal-impact-summary__stat-value">{summary.activeSignalCount}</span>
              <span className="signal-impact-summary__stat-label">Active Signals</span>
            </div>
            <div className="signal-impact-summary__stat-divider" />
            <div className="signal-impact-summary__stat">
              <span className="signal-impact-summary__stat-value">
                {summary.affectedEtfCount}/{summary.totalEtfCount}
              </span>
              <span className="signal-impact-summary__stat-label">Holdings Affected</span>
            </div>
            {healthScore && (
              <>
                <div className="signal-impact-summary__stat-divider" />
                <div className="signal-impact-summary__stat">
                  <span
                    className="signal-impact-summary__stat-value"
                    style={{ color: getGradeColor(healthScore.grade) }}
                  >
                    {healthScore.grade} {healthScore.composite}/100
                  </span>
                  <span className="signal-impact-summary__stat-label">Health</span>
                </div>
              </>
            )}

            <div className="signal-impact-summary__cta-spacer" />
            <div
              className="signal-impact-summary__cta"
              role="button"
              tabIndex={0}
              onClick={onDiscussWithPrism}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDiscussWithPrism() } }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Discuss with Prism &rarr;
            </div>
          </div>

          {summary.amplificationInsight && (
            <div className="signal-impact-summary__amplification">
              <span className="signal-impact-summary__amplification-icon">!</span>
              <span>{summary.amplificationInsight}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="signal-impact-summary__quiet">
          <span>No active signals.</span>
          {healthScore && (
            <span style={{ color: getGradeColor(healthScore.grade) }}>
              {' '}Portfolio health: {healthScore.grade} ({healthScore.composite}/100)
            </span>
          )}
        </div>
      )}
    </section>
  )
}
