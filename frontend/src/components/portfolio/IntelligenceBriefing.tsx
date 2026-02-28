import { Link } from 'react-router-dom'
import type { ExposureMap, Signal } from '@prism/shared'

interface IntelligenceBriefingProps {
  readonly signals: ReadonlyArray<Signal>
  readonly exposureMap: ExposureMap | null
  readonly totalValue: number
  readonly loading: boolean
}

function formatPortfolioValue(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function matchesExposure(affectedExposure: string, exposureCategory: string): boolean {
  const affected = normalizeLabel(affectedExposure)
  const category = normalizeLabel(exposureCategory)
  return affected.includes(category) || category.includes(affected)
}

function generateOneLiner(
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap | null,
): { text: string; tone: 'alert' | 'warning' | 'healthy'; showCta: boolean } {
  if (signals.length > 0 && exposureMap) {
    // Compute coverage across ALL signals (not just high/critical)
    const matched = exposureMap.exposures.filter((exposure) =>
      signals.some((signal) =>
        signal.affectedExposures.some((ae) => matchesExposure(ae, exposure.category)),
      ),
    )
    const coveragePct = Math.min(
      100,
      matched.reduce((sum, e) => sum + e.percentage, 0),
    )

    const hasUrgent = signals.some((s) => s.urgency === 'critical' || s.urgency === 'high')
    const tone = hasUrgent ? 'alert' as const : 'warning' as const

    return {
      text: `${signals.length} signal${signals.length > 1 ? 's' : ''} touching ${coveragePct.toFixed(0)}% of your portfolio`,
      tone,
      showCta: true,
    }
  }

  if (exposureMap && exposureMap.warnings.some((w) => w.severity === 'critical' || w.severity === 'high')) {
    return {
      text: 'Hidden concentrations detected in your holdings',
      tone: 'warning',
      showCta: false,
    }
  }

  return {
    text: `${exposureMap?.exposures.length ?? 0} sectors monitored across your holdings`,
    tone: 'healthy',
    showCta: false,
  }
}

export function IntelligenceBriefing({
  signals,
  exposureMap,
  totalValue,
  loading,
}: IntelligenceBriefingProps) {
  if (loading) {
    return (
      <section className="compact-header compact-header--loading">
        <span className="skeleton-pulse" style={{ width: 180, height: 28 }} />
        <span className="skeleton-pulse" style={{ width: 120, height: 20 }} />
      </section>
    )
  }

  const narrative = generateOneLiner(signals, exposureMap)

  return (
    <section className={`compact-header compact-header--${narrative.tone}`}>
      <div className="compact-header__left">
        <span className="compact-header__value">
          {formatPortfolioValue(totalValue)} CAD
        </span>
      </div>
      <div className="compact-header__right">
        {narrative.showCta ? (
          <Link to="/signals" className="compact-header__narrative-link">
            <span className="compact-header__narrative">{narrative.text}</span>
            <span className="compact-header__cta">Review &rarr;</span>
          </Link>
        ) : (
          <span className="compact-header__narrative">{narrative.text}</span>
        )}
      </div>
    </section>
  )
}
