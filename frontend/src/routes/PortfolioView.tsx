import { useCallback, useState } from 'react'
import { useExposureData } from '../hooks/useExposureData'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSignals } from '../hooks/useSignals'
import { usePortfolioHealth } from '../hooks/usePortfolioHealth'
import { useAppContext } from '../contexts/AppContext'
import { HoldingsList } from '../components/portfolio/HoldingsList'
import { HoldingsDrawer } from '../components/portfolio/HoldingsDrawer'
import { ExposurePieChart } from '../components/portfolio/ExposurePieChart'
import { IntelligenceBriefing } from '../components/portfolio/IntelligenceBriefing'
import { SignalCardsSection } from '../components/portfolio/SignalCardsSection'
import { RiskRadar } from '../components/portfolio/RiskRadar'
import { DISCLAIMER } from '@prism/shared'
import type { FlattenedHolding } from '../components/portfolio/HoldingsList'
import '../styles/portfolio.css'

export function PortfolioView() {
  const { userId } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const { exposureMap, loading: exposureLoading, error } = useExposureData(userId)
  const { signals, loading: signalsLoading, error: signalsError } = useSignals(userId)
  const { healthScore } = usePortfolioHealth(exposureMap)

  const [selectedHolding, setSelectedHolding] = useState<FlattenedHolding | null>(null)
  const [holdingsExpanded, setHoldingsExpanded] = useState(false)

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
  const hasSignals = signals.length > 0
  const shouldExpandHoldings = holdingsExpanded || !hasSignals

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

        {/* 2. Live Signal Cards */}
        <SignalCardsSection
          userId={userId}
          signals={signals}
          loading={signalsLoading}
          error={signalsError}
          exposures={exposureMap?.exposures}
          totalPortfolioValue={totalValue}
        />

        {/* 3. Exposure + Risk Radar side by side */}
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

            {healthScore && <RiskRadar healthScore={healthScore} />}
          </div>
        )}

        {/* 4. Collapsible Holdings */}
        {!loading && portfolio && (
          <section className="holdings-collapsible">
            <button
              type="button"
              className="holdings-collapsible__toggle"
              onClick={() => setHoldingsExpanded((prev) => !prev)}
              aria-expanded={shouldExpandHoldings}
            >
              <h2 className="section-title">Your Holdings</h2>
              <span className="holdings-collapsible__chevron">
                {shouldExpandHoldings ? '\u25B2' : '\u25BC'}
              </span>
            </button>
            {shouldExpandHoldings && (
              <HoldingsList
                portfolio={portfolio}
                selectedTicker={selectedHolding?.ticker}
                onSelect={handleSelectHolding}
              />
            )}
          </section>
        )}

        {/* 5. Disclaimer */}
        <footer className="disclaimer">
          {DISCLAIMER}
        </footer>
      </div>

      {selectedHolding && (
        <HoldingsDrawer
          holding={selectedHolding}
          exposureMap={exposureMap}
          signals={signals}
          onClose={handleCloseDrawer}
        />
      )}
    </div>
  )
}
