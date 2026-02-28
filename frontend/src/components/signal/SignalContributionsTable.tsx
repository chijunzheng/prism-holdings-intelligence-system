import { Fragment, useMemo, useState } from 'react'
import type { PortfolioNetSignalContribution } from '../../types/graph'

type ConfidenceBand = 'high' | 'moderate' | 'caution'

interface ContributionDrillDetail {
  readonly summary: string
  readonly source: string
  readonly confidenceBand: ConfidenceBand
}

interface SignalContributionsTableProps {
  readonly contributions: ReadonlyArray<PortfolioNetSignalContribution>
  readonly onSelectSignal: (signalId: string) => void
  readonly detailsBySignalId?: ReadonlyMap<string, ContributionDrillDetail>
  readonly headline?: string
  readonly subheadline?: string
  readonly showHeader?: boolean
  readonly impactColumnLabel?: string
  readonly impactBySignalId?: ReadonlyMap<string, number>
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

function confidenceLabel(band: ConfidenceBand): string {
  if (band === 'high') return 'High'
  if (band === 'caution') return 'Caution'
  return 'Moderate'
}

export function SignalContributionsTable({
  contributions,
  onSelectSignal,
  detailsBySignalId,
  headline = 'Signal contributions',
  subheadline = 'How each active signal contributes to your current modeled regime.',
  showHeader = true,
  impactColumnLabel = '1M Impact',
  impactBySignalId,
}: SignalContributionsTableProps) {
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null)

  const sorted = useMemo(
    () =>
      [...contributions].sort(
        (a, b) => {
          const aImpact = impactBySignalId?.get(a.signalId) ?? a.oneMonthImpactCad
          const bImpact = impactBySignalId?.get(b.signalId) ?? b.oneMonthImpactCad
          return Math.abs(bImpact) - Math.abs(aImpact)
        },
      ),
    [contributions, impactBySignalId],
  )

  return (
    <div className="contributions-block">
      {showHeader && (
        <div className="signals-panel__header">
          <h2 className="signals-panel__title">{headline}</h2>
          <p className="signals-panel__subtitle">{subheadline}</p>
        </div>
      )}

      <table className="contributions-table">
        <thead>
          <tr>
            <th>Signal</th>
            <th>Weight</th>
            <th>{impactColumnLabel}</th>
            <th>Direction</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const detail = detailsBySignalId?.get(c.signalId)
            const isExpanded = expandedSignalId === c.signalId
            const displayImpact = impactBySignalId?.get(c.signalId) ?? c.oneMonthImpactCad
            const weightPct = Math.round(c.normalizedWeight * 100)

            return (
              <Fragment key={c.signalId}>
                <tr className={`contributions-table__row ${isExpanded ? 'contributions-table__row--expanded' : ''}`}>
                  <td>
                    <button
                      type="button"
                      className="contributions-table__headline"
                      onClick={() => setExpandedSignalId((prev) => (prev === c.signalId ? null : c.signalId))}
                    >
                      {c.headline}
                    </button>
                  </td>
                  <td>
                    <span className="contributions-table__weight-bar">
                      <span
                        className="contributions-table__weight-fill"
                        style={{ width: `${Math.max(8, weightPct)}%` }}
                      />
                    </span>
                    <span className="contributions-table__weight-value">{weightPct}%</span>
                  </td>
                  <td>
                    <span
                      className={`contributions-table__impact ${
                        displayImpact < 0
                          ? 'contributions-table__impact--negative'
                          : 'contributions-table__impact--positive'
                      }`}
                    >
                      {formatDollar(displayImpact)}
                    </span>
                  </td>
                  <td className={`contributions-table__direction contributions-table__direction--${c.direction}`}>
                    {c.direction === 'ambiguous' ? 'Ambiguous' : c.direction === 'positive' ? 'Positive' : 'Negative'}
                  </td>
                  <td className="contributions-table__confidence-cell">
                    {detail ? (
                      <span className={`contributions-table__confidence contributions-table__confidence--${detail.confidenceBand}`}>
                        {confidenceLabel(detail.confidenceBand)}
                      </span>
                    ) : (
                      <span className="contributions-table__confidence contributions-table__confidence--moderate">Moderate</span>
                    )}
                  </td>
                </tr>

                {isExpanded && detail && (
                  <tr className="contributions-table__detail-row">
                    <td colSpan={5}>
                      <div className="contributions-table__detail">
                        <p className="contributions-table__detail-summary">{detail.summary}</p>
                        <div className="contributions-table__detail-meta">
                          <span className="contributions-table__detail-source">{detail.source}</span>
                          <button
                            type="button"
                            className="contributions-table__detail-cta"
                            onClick={() => onSelectSignal(c.signalId)}
                          >
                            View analysis &rarr;
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
