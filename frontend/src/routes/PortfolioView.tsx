import { useCallback, useState } from 'react'
import { useExposureData } from '../hooks/useExposureData'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSignals } from '../hooks/useSignals'
import { usePortfolioNetImpact } from '../hooks/usePortfolioNetImpact'
import { usePortfolioHealth } from '../hooks/usePortfolioHealth'
import { useAppContext } from '../contexts/AppContext'
import { HoldingsList } from '../components/portfolio/HoldingsList'
import { AskPrismDrawer } from '../components/portfolio/AskPrismDrawer'
import { IntelligenceBriefing } from '../components/portfolio/IntelligenceBriefing'
import { SignalImpactSummary } from '../components/portfolio/SignalImpactSummary'
import { SectorSignalMap } from '../components/portfolio/SectorSignalMap'
import { LoadingDots } from '../components/common/LoadingDots'
import type { FlattenedHolding } from '../components/portfolio/HoldingsList'
import '../styles/portfolio.css'
import '../styles/ask-prism-drawer.css'

export function PortfolioView() {
  const { userId, askPrismOpen, setAskPrismOpen, setActiveSidebarContext, setActiveAskPrismEntryContext } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const { exposureMap, loading: exposureLoading, error } = useExposureData(userId)
  const { signals, loading: signalsLoading } = useSignals(userId)
  const { data: netImpact, loading: netImpactLoading } = usePortfolioNetImpact(userId)
  const { healthScore } = usePortfolioHealth(exposureMap, signals)

  const [expandedTickers, setExpandedTickers] = useState<ReadonlySet<string>>(new Set())

  const handleToggleHolding = useCallback((holding: FlattenedHolding) => {
    setExpandedTickers((prev) => {
      const next = new Set(prev)
      if (next.has(holding.ticker)) {
        next.delete(holding.ticker)
      } else {
        next.add(holding.ticker)
      }
      return next
    })
  }, [])

  const handleDiscussWithPrism = useCallback(() => {
    setActiveAskPrismEntryContext(null)
    if (healthScore) {
      setActiveSidebarContext({
        type: 'health',
        label: `Health: ${healthScore.grade} (${healthScore.composite}/100)`,
        detail: [
          healthScore.subScores.diversification.insight,
          healthScore.subScores.concentration.insight,
          healthScore.subScores.overlap.insight,
        ].join('. '),
      })
    }
    setAskPrismOpen(true)
  }, [healthScore, setActiveSidebarContext, setActiveAskPrismEntryContext, setAskPrismOpen])

  const loading = portfolioLoading || exposureLoading || signalsLoading || netImpactLoading
  const totalValue = portfolio?.totalValueCad ?? 0

  return (
    <div className="view portfolio-view">
      <div className="portfolio-redesign">
        {error && (
          <div className="error-banner">
            <p>Unable to load exposure data: {error}</p>
            <p className="error-banner__hint">Make sure the server is running (pnpm dev:server)</p>
          </div>
        )}

        {loading ? (
          <LoadingDots className="loading-dots--full-page" />
        ) : (
          <>
            {/* 1. Compact Portfolio Header */}
            <IntelligenceBriefing
              signals={signals}
              exposureMap={exposureMap}
              totalValue={totalValue}
              loading={false}
            />

            {/* 2. Signal Impact Summary */}
            {exposureMap && (
              <SignalImpactSummary
                signals={signals}
                exposureMap={exposureMap}
                totalPortfolioValue={totalValue}
                netImpact={netImpact}
                healthScore={healthScore}
                onDiscussWithPrism={handleDiscussWithPrism}
              />
            )}

            {/* 3. Holdings — multi-expand table with inline signals */}
            {portfolio && (
              <section>
                <h2 className="section-title">Your Holdings</h2>
                <HoldingsList
                  portfolio={portfolio}
                  expandedTickers={expandedTickers}
                  onToggle={handleToggleHolding}
                  signals={signals}
                  exposureMap={exposureMap}
                  totalPortfolioValue={totalValue}
                />
              </section>
            )}

            {/* 4. Sector Signal Impact Map */}
            {exposureMap && (
              <section>
                <div className="section-header">
                  <h2 className="section-title">Sector Signal Impact</h2>
                </div>
                <span className="exposure-xray__subtitle">
                  How active signals affect each sector of your portfolio
                </span>
                <SectorSignalMap
                  exposures={exposureMap.exposures}
                  signals={signals}
                  totalPortfolioValue={totalValue}
                />
              </section>
            )}
          </>
        )}
      </div>

      {!askPrismOpen && (
        <button
          type="button"
          className="ask-prism-fab"
          onClick={() => {
            setActiveAskPrismEntryContext(null)
            setAskPrismOpen(true)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Ask Prism
        </button>
      )}

      {askPrismOpen && (
        <AskPrismDrawer onClose={() => setAskPrismOpen(false)} />
      )}
    </div>
  )
}
