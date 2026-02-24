import { useExposureData } from '../hooks/useExposureData'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSignals } from '../hooks/useSignals'
import { useAppContext } from '../contexts/AppContext'
import { HoldingsList } from '../components/portfolio/HoldingsList'
import { ExposurePieChart } from '../components/portfolio/ExposurePieChart'
import { MonitoringStatus } from '../components/portfolio/MonitoringStatus'
import { SignalCardsSection } from '../components/portfolio/SignalCardsSection'
import { ConcentrationWarning } from '../components/portfolio/ConcentrationWarning'
import { OverlapList } from '../components/portfolio/OverlapList'
import { Disclaimer } from '../components/shared/Disclaimer'
import '../styles/portfolio.css'
import '../styles/signal-cards.css'

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PortfolioView() {
  const { userId } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const { exposureMap, loading: exposureLoading, error } = useExposureData(userId)
  const { signals, loading: signalsLoading, error: signalsError } = useSignals(userId)

  const loading = portfolioLoading || exposureLoading
  const totalValue = portfolio?.totalValueCad ?? 0

  return (
    <div className="view portfolio-view">
      <nav className="portfolio-nav">
        <span className="portfolio-nav__brand">Prism</span>
        <ul className="portfolio-nav__links">
          <li className="portfolio-nav__link portfolio-nav__link--active">Portfolio</li>
          <li className="portfolio-nav__link">Activity</li>
          <li className="portfolio-nav__link">Insights</li>
        </ul>
        <div className="portfolio-nav__right">
          <span className="portfolio-nav__status">
            <span className="portfolio-nav__status-dot" />
            Markets open
          </span>
        </div>
      </nav>

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

              {portfolio && <HoldingsList portfolio={portfolio} />}

              {exposureMap && (
                <>
                  <div className="exposure-section">
                    <div className="section-header">
                      <h2 className="section-title">Exposure X-Ray</h2>
                    </div>
                    <span className="exposure-xray__subtitle">
                      True exposure across all accounts and holdings
                    </span>
                    <ExposurePieChart exposures={exposureMap.exposures} />
                  </div>

                  <SignalCardsSection
                    userId={userId}
                    signals={signals}
                    loading={signalsLoading}
                    error={signalsError}
                  />
                </>
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

      <Disclaimer />
    </div>
  )
}
