import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExposureMap, Signal } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { HoldingExposureBar } from './HoldingExposureBar'
import type { FlattenedHolding } from './HoldingsList'
import '../../styles/holdings-drawer.css'

interface HoldingsDrawerProps {
  readonly holding: FlattenedHolding
  readonly exposureMap: ExposureMap | null
  readonly signals: ReadonlyArray<Signal>
  readonly onClose: () => void
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function HoldingsDrawer({ holding, exposureMap, signals, onClose }: HoldingsDrawerProps) {
  const navigate = useNavigate()
  const { setActiveHoldingContext } = useAppContext()

  // Set active holding context when drawer opens
  useEffect(() => {
    setActiveHoldingContext({
      ticker: holding.ticker,
      name: holding.name,
      accountType: holding.accountType,
    })
    return () => setActiveHoldingContext(null)
  }, [holding.ticker, holding.name, holding.accountType, setActiveHoldingContext])

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleAskPrism = useCallback(() => {
    navigate('/ask')
  }, [navigate])

  // Filter exposures that this holding contributes to
  const holdingExposures = exposureMap
    ? exposureMap.exposures
        .filter((e) => e.contributingHoldings.some((ch) => ch.ticker === holding.ticker))
        .map((e) => {
          const contribution = e.contributingHoldings.find((ch) => ch.ticker === holding.ticker)
          return {
            category: e.category,
            percentage: contribution?.contribution ?? 0,
          }
        })
    : []

  // Filter warnings related to this holding's exposure categories
  const holdingExposureCategories = new Set(holdingExposures.map((e) => e.category))
  const relatedWarnings = exposureMap
    ? exposureMap.warnings.filter((w) => holdingExposureCategories.has(w.category))
    : []

  // Filter overlaps where this holding is a source
  const relatedOverlaps = exposureMap
    ? exposureMap.overlaps.filter((o) =>
        o.sources.some((s) => s.fundTicker === holding.ticker),
      )
    : []

  // Filter signals whose affectedExposures overlap with this holding's categories
  const relatedSignals = signals.filter((s) =>
    s.affectedExposures.some((ae) => holdingExposureCategories.has(ae)),
  )

  const severityIcon: Record<string, string> = {
    critical: '!!!',
    high: '!!',
    medium: '!',
    low: 'i',
  }

  return (
    <div className="holdings-drawer-overlay" role="dialog" aria-label={`Details for ${holding.ticker}`}>
      <div className="holdings-drawer-backdrop" onClick={onClose} />
      <div className="holdings-drawer">
        {/* Header */}
        <div className="holdings-drawer__header">
          <div>
            <div className="holdings-drawer__ticker">{holding.ticker}</div>
            <div className="holdings-drawer__name">{holding.name}</div>
            <div className="holdings-drawer__meta">
              <span className="holdings-drawer__account-badge">
                {holding.accountType.replace('_', ' ')}
              </span>
              <span>{formatCurrency(holding.valueCad)} CAD</span>
            </div>
          </div>
          <button type="button" className="holdings-drawer__close" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Exposure Breakdown */}
        <div className="holdings-drawer__section">
          <div className="holdings-drawer__section-title">Exposure Breakdown</div>
          <HoldingExposureBar exposures={holdingExposures} />
        </div>

        {/* Concentration Risk */}
        {relatedWarnings.length > 0 && (
          <div className="holdings-drawer__section">
            <div className="holdings-drawer__section-title">Concentration Risk</div>
            {relatedWarnings.map((w) => (
              <div key={w.category} className={`holdings-drawer__warning holdings-drawer__warning--${w.severity}`}>
                <span style={{ fontWeight: 700, fontSize: '0.75rem', minWidth: '1.25rem', textAlign: 'center' }}>
                  {severityIcon[w.severity] ?? 'i'}
                </span>
                {w.message}
              </div>
            ))}
          </div>
        )}

        {/* Overlapping Assets */}
        {relatedOverlaps.length > 0 && (
          <div className="holdings-drawer__section">
            <div className="holdings-drawer__section-title">Overlapping Assets</div>
            {relatedOverlaps.map((o) => (
              <div key={o.assetName} className="holdings-drawer__overlap-item">
                <div>
                  <div>{o.assetName}</div>
                  <div className="holdings-drawer__overlap-sources">
                    Also in: {o.sources
                      .filter((s) => s.fundTicker !== holding.ticker)
                      .map((s) => s.fundTicker)
                      .join(', ') || 'none'}
                  </div>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {o.totalPercentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Related Signals */}
        {relatedSignals.length > 0 && (
          <div className="holdings-drawer__section">
            <div className="holdings-drawer__section-title">Related Signals</div>
            {relatedSignals.map((s) => (
              <div key={s.id} className="holdings-drawer__signal">
                <div className="holdings-drawer__signal-headline">{s.headline}</div>
                <div className="holdings-drawer__signal-desc">{s.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Ask Prism Button */}
        <button type="button" className="holdings-drawer__ask-btn" onClick={handleAskPrism}>
          Ask Prism about {holding.ticker}
        </button>
      </div>
    </div>
  )
}
