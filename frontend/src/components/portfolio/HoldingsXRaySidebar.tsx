import type { ExposureMap, Signal, ExposureEntry } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'

interface HoldingsXRaySidebarProps {
  readonly exposureMap: ExposureMap
  readonly signals: ReadonlyArray<Signal>
  readonly totalPortfolioValue: number
  readonly onDiscussWithPrism?: (topic: 'exposure' | 'overlap') => void
}

function DiscussCta({ onClick }: { readonly onClick: () => void }) {
  return (
    <div
      className="risk-radar__cta"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      Discuss with Prism &rarr;
    </div>
  )
}

// ── Most Exposed Holdings ────────────────────────────────────
// Cross-references active signals with exposure categories,
// then drills into contributingHoldings to find the tickers
// with highest dollar exposure to signal-affected sectors.

interface ExposedHolding {
  readonly ticker: string
  readonly dollarExposure: number
  readonly sectors: ReadonlyArray<string>
  readonly signalCount: number
}

function findMostExposedHoldings(
  signals: ReadonlyArray<Signal>,
  exposures: ReadonlyArray<ExposureEntry>,
  totalValue: number,
): ReadonlyArray<ExposedHolding> {
  if (signals.length === 0 || exposures.length === 0 || totalValue === 0) {
    return []
  }

  const holdingImpacts = new Map<string, { dollarExposure: number; sectors: Set<string>; signalIds: Set<string> }>()

  for (const signal of signals) {
    const affected = exposures.filter((e) =>
      signal.affectedExposures.some(
        (ae) =>
          e.category.toLowerCase().includes(ae.toLowerCase()) ||
          ae.toLowerCase().includes(e.category.toLowerCase()),
      ),
    )

    for (const exposure of affected) {
      for (const holding of exposure.contributingHoldings) {
        const dollarExposure = (holding.contribution / 100) * totalValue
        const existing = holdingImpacts.get(holding.ticker)
        if (existing) {
          if (dollarExposure > existing.dollarExposure) {
            existing.dollarExposure = dollarExposure
          }
          existing.sectors.add(exposure.category)
          existing.signalIds.add(signal.id)
        } else {
          holdingImpacts.set(holding.ticker, {
            dollarExposure,
            sectors: new Set([exposure.category]),
            signalIds: new Set([signal.id]),
          })
        }
      }
    }
  }

  return [...holdingImpacts.entries()]
    .map(([ticker, data]) => ({
      ticker,
      dollarExposure: data.dollarExposure,
      sectors: [...data.sectors],
      signalCount: data.signalIds.size,
    }))
    .sort((a, b) => b.dollarExposure - a.dollarExposure)
    .slice(0, 3)
}

function formatDollar(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return `$${amount.toFixed(0)}`
}

// ── Component ────────────────────────────────────────────────

export function HoldingsXRaySidebar({
  exposureMap,
  signals,
  totalPortfolioValue,
  onDiscussWithPrism,
}: HoldingsXRaySidebarProps) {
  const exposedHoldings = findMostExposedHoldings(
    signals,
    exposureMap.exposures,
    totalPortfolioValue,
  )

  const topOverlaps = exposureMap.overlaps.slice(0, 3)

  const topWarning = exposureMap.warnings.find(
    (w) => w.severity === 'critical' || w.severity === 'high',
  )

  const hasContent = exposedHoldings.length > 0 || topOverlaps.length > 0 || topWarning

  if (!hasContent) return null

  return (
    <aside className="holdings-xray-sidebar risk-radar">
      {/* Signal Exposure — holdings most affected by active signals */}
      {exposedHoldings.length > 0 && (
        <div className="holdings-xray-sidebar__section">
          <h3 className="risk-radar__title">Signal Exposure</h3>
          <p className="holdings-xray-sidebar__section-desc">
            Holdings most affected by active signals
          </p>
          <ul className="holdings-xray-sidebar__list">
            {exposedHoldings.map((h) => (
              <li key={h.ticker} className="holdings-xray-sidebar__item">
                <div className="holdings-xray-sidebar__item-header">
                  <span className="holdings-xray-sidebar__ticker">
                    <TickerIcon ticker={h.ticker} size={20} />
                    {h.ticker}
                  </span>
                  <span className="holdings-xray-sidebar__value">
                    {formatDollar(h.dollarExposure)} at risk
                  </span>
                </div>
                <span className="holdings-xray-sidebar__detail" title={h.sectors.join(', ')}>
                  {h.sectors.join(', ')}
                  {h.signalCount > 1 ? ` · ${h.signalCount} signals` : ''}
                </span>
              </li>
            ))}
          </ul>
          {onDiscussWithPrism && (
            <DiscussCta onClick={() => onDiscussWithPrism('exposure')} />
          )}
        </div>
      )}

      {/* Hidden Overlaps */}
      {topOverlaps.length > 0 && (
        <div className="holdings-xray-sidebar__section">
          <h3 className="risk-radar__title">Hidden Overlaps</h3>
          <ul className="holdings-xray-sidebar__list">
            {topOverlaps.map((o) => (
              <li key={o.assetName} className="holdings-xray-sidebar__item">
                <div className="holdings-xray-sidebar__item-header">
                  <span className="holdings-xray-sidebar__ticker">
                    <TickerIcon ticker={o.assetTicker ?? o.assetName} size={20} />
                    {o.assetTicker ?? o.assetName}
                  </span>
                  <span className="overlap-item__total">
                    {o.totalPercentage.toFixed(1)}%
                  </span>
                </div>
                <span className="holdings-xray-sidebar__detail">
                  In {o.sources.map((s) => s.fundTicker).join(', ')}
                </span>
              </li>
            ))}
          </ul>
          {onDiscussWithPrism && (
            <DiscussCta onClick={() => onDiscussWithPrism('overlap')} />
          )}
        </div>
      )}

      {/* Concentration Alert */}
      {topWarning && (
        <div className="holdings-xray-sidebar__section">
          <div className={`concentration-warning concentration-warning--${topWarning.severity}`}>
            <span className="concentration-warning__icon">!</span>
            <span>{topWarning.message}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
