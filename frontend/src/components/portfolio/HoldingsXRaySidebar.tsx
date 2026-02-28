import { useMemo } from 'react'
import type { ExposureMap, Signal, Portfolio } from '@prism/shared'
import type { FlattenedHolding } from './HoldingsList'
import { flattenHoldings } from './HoldingsList'
import { TickerIcon } from '../common/TickerIcon'
import { formatExposureCategory } from './exposure-category'

interface HoldingsXRaySidebarProps {
  readonly exposureMap: ExposureMap
  readonly signals: ReadonlyArray<Signal>
  readonly totalPortfolioValue: number
  readonly portfolio: Portfolio
  readonly selectedHolding?: FlattenedHolding | null
  readonly onSelectHolding?: (holding: FlattenedHolding) => void
  readonly onDiscussWithPrism?: (topic: 'exposure' | 'overlap') => void
}

// ── Shared utilities ────────────────────────────────────────

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1000) {
    return `$${(abs / 1000).toFixed(1)}k`
  }
  return `$${abs.toFixed(0)}`
}

function formatSignedDollar(amount: number): string {
  const prefix = amount < 0 ? '-' : '+'
  return `${prefix}${formatDollar(amount)}`
}

function getSentimentDirection(signal: Signal): number {
  const narrative = `${signal.headline} ${signal.description}`.toLowerCase()
  const positiveHint = /(strong|beat|growth|upgrade|boost|surge|rally)/.test(narrative)
  const negativeHint = /(tariff|downgrade|decline|drop|risk|tension|shock|selloff)/.test(narrative)
  return positiveHint && !negativeHint ? 1 : -1
}

function getMagnitude(urgency: string): number {
  if (urgency === 'critical') return 0.05
  if (urgency === 'high') return 0.03
  if (urgency === 'medium') return 0.02
  return 0.01
}

// ── Per-Holding Signal Summary ──────────────────────────────

interface HoldingSignalSummary {
  readonly ticker: string
  readonly name: string
  readonly valueCad: number
  readonly netDollarImpact: number
  readonly signalCount: number
  readonly topSector: string | null
  readonly topSectorPct: number
  readonly holding: FlattenedHolding
}

function computeAllHoldingSignalSummaries(
  portfolio: Portfolio,
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap,
  totalPortfolioValue: number,
): ReadonlyArray<HoldingSignalSummary> {
  const holdings = flattenHoldings(portfolio)

  return holdings.map((h) => {
    let netDollarImpact = 0
    const signalIds = new Set<string>()
    let topSector: string | null = null
    let topSectorPct = 0

    // Find this holding's top sector exposure
    for (const exposure of exposureMap.exposures) {
      const match = exposure.contributingHoldings.find((ch) => ch.ticker === h.ticker)
      if (match && match.contribution > topSectorPct) {
        topSectorPct = match.contribution
        topSector = exposure.category
      }
    }

    // Compute signal impact
    for (const signal of signals) {
      const affected = exposureMap.exposures.filter((e) =>
        signal.affectedExposures.some(
          (ae) =>
            e.category.toLowerCase().includes(ae.toLowerCase()) ||
            ae.toLowerCase().includes(e.category.toLowerCase()),
        ),
      )

      let holdingContribution = 0
      for (const exposure of affected) {
        const match = exposure.contributingHoldings.find((ch) => ch.ticker === h.ticker)
        if (match) {
          holdingContribution += match.contribution
        }
      }

      if (holdingContribution > 0) {
        const dollarExposure = (holdingContribution / 100) * totalPortfolioValue
        const impact = dollarExposure * getMagnitude(signal.urgency) * getSentimentDirection(signal) * signal.relevanceScore
        netDollarImpact += impact
        signalIds.add(signal.id)
      }
    }

    return {
      ticker: h.ticker,
      name: h.name,
      valueCad: h.valueCad,
      netDollarImpact,
      signalCount: signalIds.size,
      topSector,
      topSectorPct,
      holding: h,
    }
  }).sort((a, b) => {
    // Sort by signal count desc, then by absolute impact desc
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount
    return Math.abs(b.netDollarImpact) - Math.abs(a.netDollarImpact)
  })
}

// ── Default View: All Holdings by Signal Exposure ───────────

function SignalExposureByHoldingView({
  portfolio,
  exposureMap,
  signals,
  totalPortfolioValue,
  selectedHolding,
  onSelectHolding,
  onDiscussWithPrism,
}: HoldingsXRaySidebarProps) {
  const summaries = useMemo(
    () => computeAllHoldingSignalSummaries(portfolio, signals, exposureMap, totalPortfolioValue),
    [portfolio, signals, exposureMap, totalPortfolioValue],
  )

  const topWarning = exposureMap.warnings.find(
    (w) => w.severity === 'critical' || w.severity === 'high',
  )

  const affectedCount = summaries.filter((s) => s.signalCount > 0).length
  const totalCount = summaries.length

  return (
    <>
      <div className="holdings-xray-sidebar__section">
        <h3 className="risk-radar__title">Signal Exposure by Holding</h3>
        <p className="holdings-xray-sidebar__section-desc">
          {affectedCount} of {totalCount} holdings affected by active signals
        </p>

        <div className="holdings-xray-sidebar__holding-list">
          {summaries.map((s) => {
            const isSelected = selectedHolding?.ticker === s.ticker
            const hasImpact = s.signalCount > 0
            const impactClass = s.netDollarImpact > 10 ? 'positive' : s.netDollarImpact < -10 ? 'negative' : 'neutral'

            return (
              <div
                key={s.ticker}
                className={[
                  'holdings-xray-sidebar__holding-row',
                  isSelected ? 'holdings-xray-sidebar__holding-row--selected' : '',
                  onSelectHolding ? 'holdings-xray-sidebar__holding-row--clickable' : '',
                ].filter(Boolean).join(' ')}
                role={onSelectHolding ? 'button' : undefined}
                tabIndex={onSelectHolding ? 0 : undefined}
                onClick={onSelectHolding ? () => onSelectHolding(s.holding) : undefined}
                onKeyDown={onSelectHolding ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectHolding(s.holding)
                  }
                } : undefined}
              >
                <div className="holdings-xray-sidebar__holding-top">
                  <span className="holdings-xray-sidebar__ticker">
                    <TickerIcon ticker={s.ticker} size={20} />
                    {s.ticker}
                  </span>
                  {hasImpact ? (
                    <span className={`holdings-xray-sidebar__impact holdings-xray-sidebar__impact--${impactClass}`}>
                      {formatSignedDollar(s.netDollarImpact)}
                    </span>
                  ) : (
                    <span className="holdings-xray-sidebar__impact holdings-xray-sidebar__impact--neutral">
                      —
                    </span>
                  )}
                </div>
                <div className="holdings-xray-sidebar__holding-meta">
                  {hasImpact ? (
                    <span>
                      {s.signalCount} signal{s.signalCount > 1 ? 's' : ''}
                      {s.topSector ? ` · ${formatExposureCategory(s.topSector)}` : ''}
                    </span>
                  ) : (
                    <span className="holdings-xray-sidebar__no-signal">No active signals</span>
                  )}
                </div>
                {hasImpact && s.topSector && (
                  <div className="holdings-xray-sidebar__mini-bar-track">
                    <div
                      className={`holdings-xray-sidebar__mini-bar-fill holdings-xray-sidebar__mini-bar-fill--${impactClass}`}
                      style={{ width: `${Math.min(100, s.topSectorPct * 3)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {topWarning && (
        <div className="holdings-xray-sidebar__section">
          <div className={`concentration-warning concentration-warning--${topWarning.severity}`}>
            <span className="concentration-warning__icon">!</span>
            <span>{topWarning.message}</span>
          </div>
        </div>
      )}

      {onDiscussWithPrism && (
        <div className="holdings-xray-sidebar__section">
          <DiscussCta onClick={() => onDiscussWithPrism('exposure')} />
        </div>
      )}
    </>
  )
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Discuss with Prism &rarr;
    </div>
  )
}

// ── ETF-Scoped View ─────────────────────────────────────────

interface ScopedSignalImpact {
  readonly signalHeadline: string
  readonly dollarImpact: number
  readonly sectors: ReadonlyArray<string>
}

interface ScopedExposure {
  readonly category: string
  readonly contribution: number
}

function HoldingScopedView({
  holding,
  exposureMap,
  signals,
  totalPortfolioValue,
}: {
  readonly holding: FlattenedHolding
  readonly exposureMap: ExposureMap
  readonly signals: ReadonlyArray<Signal>
  readonly totalPortfolioValue: number
}) {
  const ticker = holding.ticker

  const signalImpacts = useMemo((): ReadonlyArray<ScopedSignalImpact> => {
    const results: ScopedSignalImpact[] = []
    for (const signal of signals) {
      const affected = exposureMap.exposures.filter((e) =>
        signal.affectedExposures.some(
          (ae) =>
            e.category.toLowerCase().includes(ae.toLowerCase()) ||
            ae.toLowerCase().includes(e.category.toLowerCase()),
        ),
      )
      const matchedSectors: string[] = []
      let totalContribution = 0
      for (const exposure of affected) {
        const match = exposure.contributingHoldings.find((h) => h.ticker === ticker)
        if (match) {
          matchedSectors.push(exposure.category)
          totalContribution += match.contribution
        }
      }
      if (matchedSectors.length > 0) {
        const dollarExposure = (totalContribution / 100) * totalPortfolioValue
        const direction = getSentimentDirection(signal)
        const magnitude = getMagnitude(signal.urgency)
        results.push({
          signalHeadline: signal.headline,
          dollarImpact: dollarExposure * magnitude * direction * signal.relevanceScore,
          sectors: matchedSectors,
        })
      }
    }
    return results
  }, [signals, exposureMap, ticker, totalPortfolioValue])

  const scopedExposures = useMemo((): ReadonlyArray<ScopedExposure> => {
    return exposureMap.exposures
      .map((e) => {
        const match = e.contributingHoldings.find((h) => h.ticker === ticker)
        if (!match) return null
        return { category: e.category, contribution: match.contribution }
      })
      .filter((x): x is ScopedExposure => x !== null)
      .sort((a, b) => b.contribution - a.contribution)
  }, [exposureMap, ticker])

  // Other ETFs also affected by the same signals
  const alsoAffectedETFs = useMemo(() => {
    const mySignalIds = new Set<string>()
    for (const signal of signals) {
      const affected = exposureMap.exposures.filter((e) =>
        signal.affectedExposures.some(
          (ae) =>
            e.category.toLowerCase().includes(ae.toLowerCase()) ||
            ae.toLowerCase().includes(e.category.toLowerCase()),
        ),
      )
      for (const exposure of affected) {
        if (exposure.contributingHoldings.some((h) => h.ticker === ticker)) {
          mySignalIds.add(signal.id)
        }
      }
    }

    const otherTickers = new Map<string, number>()
    for (const signal of signals) {
      if (!mySignalIds.has(signal.id)) continue
      const affected = exposureMap.exposures.filter((e) =>
        signal.affectedExposures.some(
          (ae) =>
            e.category.toLowerCase().includes(ae.toLowerCase()) ||
            ae.toLowerCase().includes(e.category.toLowerCase()),
        ),
      )
      for (const exposure of affected) {
        for (const h of exposure.contributingHoldings) {
          if (h.ticker !== ticker) {
            otherTickers.set(h.ticker, (otherTickers.get(h.ticker) ?? 0) + 1)
          }
        }
      }
    }

    return [...otherTickers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [signals, exposureMap, ticker])

  const concentrationWarnings = useMemo(() => {
    return exposureMap.warnings.filter((w) => {
      const exposure = exposureMap.exposures.find((e) => e.category === w.category)
      return exposure?.contributingHoldings.some((h) => h.ticker === ticker)
    })
  }, [exposureMap, ticker])

  const maxContribution = scopedExposures.length > 0
    ? Math.max(...scopedExposures.map((e) => e.contribution))
    : 0

  return (
    <>
      <div className="holdings-xray-sidebar__section">
        <div className="holdings-xray-sidebar__scoped-header">
          <TickerIcon ticker={ticker} size={28} />
          <div>
            <h3 className="holdings-xray-sidebar__scoped-title">{ticker}</h3>
            <span className="holdings-xray-sidebar__scoped-subtitle">{holding.name}</span>
          </div>
        </div>
      </div>

      {/* Signal Impact */}
      {signalImpacts.length > 0 && (
        <div className="holdings-xray-sidebar__section">
          <h3 className="risk-radar__title">Signal Impact</h3>
          <ul className="holdings-xray-sidebar__list">
            {signalImpacts.map((si) => (
              <li key={si.signalHeadline} className="holdings-xray-sidebar__item">
                <div className="holdings-xray-sidebar__item-header">
                  <span className="holdings-xray-sidebar__detail" style={{ fontWeight: 500, whiteSpace: 'normal' }}>
                    {si.signalHeadline}
                  </span>
                  <span className={`holdings-xray-sidebar__impact holdings-xray-sidebar__impact--${si.dollarImpact < 0 ? 'neg' : 'pos'}`}>
                    {formatSignedDollar(si.dollarImpact)}
                  </span>
                </div>
                <span className="holdings-xray-sidebar__detail">
                  {si.sectors.map((s) => formatExposureCategory(s)).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* True Exposure */}
      {scopedExposures.length > 0 && (
        <div className="holdings-xray-sidebar__section">
          <h3 className="risk-radar__title">True Exposure</h3>
          <p className="holdings-xray-sidebar__section-desc">
            What sectors {ticker} holds
          </p>
          <div className="holdings-xray-sidebar__bars">
            {scopedExposures.slice(0, 5).map((e) => (
              <div key={e.category} className="holdings-xray-sidebar__bar-row">
                <div className="holdings-xray-sidebar__bar-label">
                  <span>{formatExposureCategory(e.category)}</span>
                  <span className="holdings-xray-sidebar__bar-value">{e.contribution.toFixed(1)}%</span>
                </div>
                <div className="holdings-xray-sidebar__bar-track">
                  <div
                    className="holdings-xray-sidebar__bar-fill"
                    style={{ width: `${maxContribution > 0 ? (e.contribution / maxContribution) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Also Affected ETFs */}
      {alsoAffectedETFs.length > 0 && (
        <div className="holdings-xray-sidebar__section">
          <h3 className="risk-radar__title">Also Affected</h3>
          <p className="holdings-xray-sidebar__section-desc">
            Other holdings hit by the same signals
          </p>
          <div className="holdings-xray-sidebar__also-affected">
            {alsoAffectedETFs.map(([etfTicker, count]) => (
              <span key={etfTicker} className="holdings-xray-sidebar__also-chip">
                <TickerIcon ticker={etfTicker} size={16} />
                {etfTicker}
                <span className="holdings-xray-sidebar__also-count">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Concentration */}
      {concentrationWarnings.length > 0 && (
        <div className="holdings-xray-sidebar__section">
          <h3 className="risk-radar__title">Concentration Risk</h3>
          {concentrationWarnings.map((w) => (
            <div key={w.category} className={`concentration-warning concentration-warning--${w.severity}`}>
              <span className="concentration-warning__icon">!</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {signalImpacts.length === 0 && (
        <div className="holdings-xray-sidebar__section">
          <p className="holdings-xray-sidebar__section-desc">
            No active signals currently affecting {ticker}.
          </p>
        </div>
      )}
    </>
  )
}

// ── Main Component ──────────────────────────────────────────

export function HoldingsXRaySidebar({
  exposureMap,
  signals,
  totalPortfolioValue,
  portfolio,
  selectedHolding = null,
  onSelectHolding,
  onDiscussWithPrism,
}: HoldingsXRaySidebarProps) {
  return (
    <aside className="holdings-xray-sidebar risk-radar">
      {selectedHolding ? (
        <HoldingScopedView
          holding={selectedHolding}
          exposureMap={exposureMap}
          signals={signals}
          totalPortfolioValue={totalPortfolioValue}
        />
      ) : (
        <SignalExposureByHoldingView
          portfolio={portfolio}
          exposureMap={exposureMap}
          signals={signals}
          totalPortfolioValue={totalPortfolioValue}
          selectedHolding={selectedHolding}
          onSelectHolding={onSelectHolding}
          onDiscussWithPrism={onDiscussWithPrism}
        />
      )}
    </aside>
  )
}
