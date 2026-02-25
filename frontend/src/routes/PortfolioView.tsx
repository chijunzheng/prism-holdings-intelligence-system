import { useCallback, useState } from 'react'
import { useExposureData } from '../hooks/useExposureData'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSignals } from '../hooks/useSignals'
import { useAppContext } from '../contexts/AppContext'
import { HoldingsList } from '../components/portfolio/HoldingsList'
import { HoldingsDrawer } from '../components/portfolio/HoldingsDrawer'
import { ExposurePieChart } from '../components/portfolio/ExposurePieChart'
import { MonitoringStatus } from '../components/portfolio/MonitoringStatus'
import { ConcentrationWarning } from '../components/portfolio/ConcentrationWarning'
import { OverlapList } from '../components/portfolio/OverlapList'
import type { FlattenedHolding } from '../components/portfolio/HoldingsList'
import '../styles/portfolio.css'

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PortfolioView() {
  const { userId } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const { exposureMap, loading: exposureLoading, error } = useExposureData(userId)
  const { signals } = useSignals(userId)

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
      <div className="portfolio-content">
        <div className="portfolio-main">
          {loading && <div className="loading">Analyzing your portfolio...</div>}

          {error && (
            <div className="error-banner">
              <p>Unable to load exposure data: {error}</p>
              <p className="error-banner__hint">Make sure the server is running (pnpm dev:server)</p>
            </div>
          )}

          {!loading && (
            <>
              <div className="portfolio-value">
                <span className="portfolio-value__amount">
                  {formatCurrency(totalValue)} CAD
                </span>
              </div>

              {portfolio && (
                <HoldingsList
                  portfolio={portfolio}
                  selectedTicker={selectedHolding?.ticker}
                  onSelect={handleSelectHolding}
                />
              )}

              {exposureMap && (
                <div className="exposure-section">
                  <div className="section-header">
                    <h2 className="section-title">What You Really Own</h2>
                  </div>
                  <span className="exposure-xray__subtitle">
                    True sector and geographic exposure across all your ETFs
                  </span>
                  <ExposurePieChart exposures={exposureMap.exposures} />
                </div>
              )}
            </>
          )}
        </div>

        {exposureMap && (
          <aside className="portfolio-sidebar">
            <div className="sidebar-card">
              <span className="sidebar-card__label">Exposure categories</span>
              <span className="sidebar-card__value">{exposureMap.exposures.length}</span>
              <div className="sidebar-card__divider" />
              <MonitoringStatus exposureMap={exposureMap} />
            </div>

            {exposureMap.warnings.length > 0 && (
              <div className="sidebar-card">
                <ConcentrationWarning warnings={exposureMap.warnings} />
              </div>
            )}

            {exposureMap.overlaps.length > 0 && (
              <div className="sidebar-card">
                <h3 className="concentration-warnings__title">Overlapping Holdings</h3>
                <OverlapList overlaps={exposureMap.overlaps} />
              </div>
            )}
          </aside>
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
    </div>
  )
}
