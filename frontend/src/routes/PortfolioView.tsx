import { useCallback, useState } from 'react'
import { useExposureData } from '../hooks/useExposureData'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSignals } from '../hooks/useSignals'
import { usePortfolioHealth } from '../hooks/usePortfolioHealth'
import { useAppContext } from '../contexts/AppContext'
import { HoldingsList } from '../components/portfolio/HoldingsList'
import { HoldingsDrawer } from '../components/portfolio/HoldingsDrawer'
import { AskPrismDrawer } from '../components/portfolio/AskPrismDrawer'
import { ExposurePieChart } from '../components/portfolio/ExposurePieChart'
import { IntelligenceBriefing } from '../components/portfolio/IntelligenceBriefing'
import { SignalCardsSection } from '../components/portfolio/SignalCardsSection'
import { RiskRadar } from '../components/portfolio/RiskRadar'
import { HoldingsXRaySidebar } from '../components/portfolio/HoldingsXRaySidebar'
import type { FlattenedHolding } from '../components/portfolio/HoldingsList'
import '../styles/portfolio.css'
import '../styles/signal-cards.css'
import '../styles/ask-prism-drawer.css'

export function PortfolioView() {
  const { userId, askPrismOpen, setAskPrismOpen, setActiveSidebarContext } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const { exposureMap, loading: exposureLoading, error } = useExposureData(userId)
  const {
    signals,
    loading: signalsLoading,
    error: signalsError,
    mode: signalsMode,
    requestId: signalsRequestId,
  } = useSignals(userId)
  const { healthScore } = usePortfolioHealth(exposureMap)

  const [selectedHolding, setSelectedHolding] = useState<FlattenedHolding | null>(null)


  const handleSelectHolding = useCallback((holding: FlattenedHolding) => {
    setSelectedHolding((prev) =>
      prev?.ticker === holding.ticker ? null : holding,
    )
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedHolding(null)
  }, [])

  const loading = portfolioLoading || exposureLoading
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

        {/* 1. Intelligence Briefing Hero */}
        <IntelligenceBriefing
          healthScore={healthScore}
          signals={signals}
          exposureMap={exposureMap}
          totalValue={totalValue}
          loading={loading}
        />

        {/* 2. Signal Cards — horizontal row */}
        <SignalCardsSection
          userId={userId}
          signals={signals}
          loading={signalsLoading}
          error={signalsError}
          mode={signalsMode}
          requestId={signalsRequestId}
          exposures={exposureMap?.exposures}
          totalPortfolioValue={totalValue}
        />

        {/* 3. Holdings — familiar context first */}
        {!loading && portfolio && (
          <div className="holdings-radar-row">
            <section className="holdings-section">
              <h2 className="section-title">Your Holdings</h2>
              <HoldingsList
                portfolio={portfolio}
                selectedTicker={selectedHolding?.ticker}
                onSelect={handleSelectHolding}
              />
            </section>
            {exposureMap && (
              <HoldingsXRaySidebar
                exposureMap={exposureMap}
                signals={signals}
                totalPortfolioValue={totalValue}
                onDiscussWithPrism={() => {
                  setActiveSidebarContext({
                    type: 'exposure',
                    label: 'Holdings exposure',
                    detail: 'Most exposed holdings and hidden overlaps in my portfolio.',
                  })
                  setAskPrismOpen(true)
                }}
              />
            )}
          </div>
        )}

        {/* 4. Exposure X-Ray (left) + Risk Radar (right) */}
        {!loading && exposureMap && (
          <div className="exposure-radar-row">
            <div className="exposure-section">
              <div className="section-header">
                <h2 className="section-title">What You Really Own</h2>
              </div>
              <span className="exposure-xray__subtitle">
                True sector and geographic exposure across all your ETFs
              </span>
              <ExposurePieChart exposures={exposureMap.exposures} />
            </div>

            {healthScore && (
              <RiskRadar
                healthScore={healthScore}
                onClick={() => {
                  setActiveSidebarContext({
                    type: 'health',
                    label: `Health: ${healthScore.grade} (${healthScore.composite}/100)`,
                    detail: [
                      healthScore.subScores.diversification.insight,
                      healthScore.subScores.concentration.insight,
                      healthScore.subScores.overlap.insight,
                    ].join('. '),
                  })
                  setAskPrismOpen(true)
                }}
              />
            )}
          </div>
        )}

      </div>

      {selectedHolding && (
        <HoldingsDrawer
          holding={selectedHolding}
          exposureMap={exposureMap}
          signals={signals}
          onClose={handleCloseDrawer}
        />
      )}

      {!askPrismOpen && (
        <button
          type="button"
          className="ask-prism-fab"
          onClick={() => setAskPrismOpen(true)}
        >
          Ask Prism
        </button>
      )}

      {askPrismOpen && (
        <AskPrismDrawer onClose={() => setAskPrismOpen(false)} />
      )}
    </div>
  )
}
