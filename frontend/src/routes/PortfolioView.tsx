import { useExposureData } from '../hooks/useExposureData'
import { useSignals } from '../hooks/useSignals'
import { ExposureXRay } from '../components/portfolio/ExposureXRay'
import { MonitoringStatus } from '../components/portfolio/MonitoringStatus'
import { SignalCardsSection } from '../components/portfolio/SignalCardsSection'
import { Disclaimer } from '../components/shared/Disclaimer'
import '../styles/portfolio.css'
import '../styles/signal-cards.css'

const DEFAULT_USER_ID = 'sarah-01'

export function PortfolioView() {
  const { exposureMap, loading, error } = useExposureData(DEFAULT_USER_ID)
  const { signals, loading: signalsLoading, error: signalsError } = useSignals(DEFAULT_USER_ID)

  return (
    <div className="view portfolio-view">
      <header className="portfolio-header">
        <h1>Portfolio</h1>
        <span className="portfolio-header__user">Sarah&apos;s Portfolio</span>
      </header>

      <main>
        {loading && <div className="loading">Analyzing your portfolio...</div>}

        {error && (
          <div className="error-banner">
            <p>Unable to load exposure data: {error}</p>
            <p className="error-banner__hint">Make sure the server is running (pnpm dev:server)</p>
          </div>
        )}

        {exposureMap && (
          <>
            <section className="section">
              <div className="portfolio-value">
                <span className="portfolio-value__label">Total Portfolio Value</span>
                <span className="portfolio-value__amount">
                  ${exposureMap.exposures.reduce((s, e) => s + e.valueCad, 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </section>

            <section className="section">
              <ExposureXRay exposureMap={exposureMap} />
            </section>

            <section className="section">
              <MonitoringStatus exposureMap={exposureMap} />
            </section>

            <section className="section">
              <SignalCardsSection
                userId={DEFAULT_USER_ID}
                signals={signals}
                loading={signalsLoading}
                error={signalsError}
              />
            </section>
          </>
        )}
      </main>

      <Disclaimer />
    </div>
  )
}
