import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Holding, Portfolio, Signal, ExposureMap } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'
import { formatExposureCategory } from './exposure-category'
import {
  computeHoldingImpacts,
  formatImpact,
  getTemporalLabel,
  type HoldingImpact,
} from './signal-impact-utils'

export type FlattenedHolding = Holding & {
  readonly accountId: string
}

interface HoldingsListProps {
  readonly portfolio: Portfolio
  readonly expandedTickers?: ReadonlySet<string>
  readonly onToggle?: (holding: FlattenedHolding) => void
  readonly signals?: ReadonlyArray<Signal>
  readonly exposureMap?: ExposureMap | null
  readonly totalPortfolioValue?: number
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatUnits(units: number): string {
  return units % 1 === 0
    ? `${units.toLocaleString()} shares`
    : `${units.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} units`
}

export function flattenHoldings(portfolio: Portfolio): ReadonlyArray<FlattenedHolding> {
  return portfolio.accounts.flatMap((account) =>
    account.holdings.map((h) => ({
      ...h,
      accountId: account.id,
    })),
  )
}

// ── Expanded Signal Detail Panel ────────────────────────────

function HoldingSignalDetail({
  impact,
  ticker,
}: {
  readonly impact: HoldingImpact
  readonly ticker: string
}) {
  const navigate = useNavigate()

  return (
    <div className="holdings-expand">
      <div className="holdings-expand__signals">
        {impact.signals.map((s) => {
          const impactClass = s.dollarImpact < -10 ? 'negative' : s.dollarImpact > 10 ? 'positive' : 'neutral'
          const temporalLabel = getTemporalLabel(s.temporalClassification)
          return (
            <div
              key={s.signalId}
              className="holdings-expand__signal-row holdings-expand__signal-row--clickable"
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/signals/${s.signalId}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/signals/${s.signalId}`)
                }
              }}
            >
              <div className="holdings-expand__signal-top">
                <span className="holdings-expand__signal-headline">{s.headline}</span>
                <span className={`holdings-expand__signal-impact holdings-expand__signal-impact--${impactClass}`}>
                  {formatImpact(s.dollarImpact)}
                </span>
              </div>
              <div className="holdings-expand__signal-meta">
                {s.sectors.map((sec) => (
                  <span key={sec} className="holdings-expand__sector-chip">
                    {formatExposureCategory(sec)}
                  </span>
                ))}
                {temporalLabel && (
                  <span className="holdings-expand__temporal">{temporalLabel}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {impact.topSector && (
        <div className="holdings-expand__exposure-note">
          Primary exposure: {formatExposureCategory(impact.topSector)} ({impact.topSectorPct.toFixed(1)}% of {ticker})
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────

export function HoldingsList({
  portfolio,
  expandedTickers = new Set(),
  onToggle,
  signals = [],
  exposureMap = null,
  totalPortfolioValue = 0,
}: HoldingsListProps) {
  const holdings = flattenHoldings(portfolio)
  const sorted = [...holdings].sort((a, b) => b.valueCad - a.valueCad)

  const impactMap = useMemo(() => {
    if (!exposureMap || signals.length === 0 || totalPortfolioValue === 0) {
      return new Map<string, HoldingImpact>()
    }
    return computeHoldingImpacts(signals, exposureMap, totalPortfolioValue)
  }, [signals, exposureMap, totalPortfolioValue])

  return (
    <div className="holdings-section">
      <div className="holdings-card">
        <table className="holdings-table">
          <thead>
            <tr>
              <th colSpan={3} className="holdings-header-cell">
                <div className="holdings-header-row">
                  <span className="holdings-header-row__positions">Positions</span>
                  <span className="holdings-header-row__impact">Signal Impact</span>
                  <span className="holdings-header-row__value">Total value</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const key = `${h.accountType}-${h.ticker}`
              const isExpanded = expandedTickers.has(h.ticker)
              const impact = impactMap.get(h.ticker)
              const rowClass = [
                'holdings-row',
                onToggle ? 'holdings-row--clickable' : '',
                isExpanded ? 'holdings-row--selected' : '',
              ].filter(Boolean).join(' ')

              return (
                <tr key={key} className="holdings-row-group">
                  <td colSpan={3} className="holdings-row-group__cell">
                    <div
                      className={rowClass}
                      onClick={onToggle ? () => onToggle(h) : undefined}
                      onKeyDown={onToggle ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onToggle(h)
                        }
                      } : undefined}
                      tabIndex={onToggle ? 0 : undefined}
                      role={onToggle ? 'button' : undefined}
                      aria-expanded={isExpanded || undefined}
                    >
                      <div className="holdings-row__position-cell">
                        <TickerIcon ticker={h.ticker} size={36} />
                        <div>
                          <div className="holdings-row__position-name">{h.ticker}</div>
                          <div className="holdings-row__position-sub">
                            {h.name} · {h.accountType.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <div className="holdings-row__impact text-right">
                        {impact && impact.direction !== 'neutral' ? (
                          <span className={`holdings-row__impact-badge holdings-row__impact-badge--${impact.direction}`}>
                            <span className="holdings-row__impact-dot" />
                            {formatImpact(impact.dollarImpact)}
                            {impact.signalCount > 1 && (
                              <span className="holdings-row__impact-count">
                                {impact.signalCount}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="holdings-row__impact-badge holdings-row__impact-badge--neutral">
                            —
                          </span>
                        )}
                      </div>
                      <div className="holdings-row__value text-right">
                        <div className="holdings-row__value-amount">{formatCurrency(h.valueCad)} CAD</div>
                        <div className="holdings-row__value-shares">{formatUnits(h.units)}</div>
                      </div>
                    </div>

                    {/* Expanded signal detail — inline accordion */}
                    {isExpanded && impact && impact.signals.length > 0 && (
                      <HoldingSignalDetail impact={impact} ticker={h.ticker} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
