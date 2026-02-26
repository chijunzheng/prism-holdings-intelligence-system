import type { ExposureMap, HealthScore, Signal } from '@prism/shared'

interface IntelligenceBriefingProps {
  readonly healthScore: HealthScore | null
  readonly signals: ReadonlyArray<Signal>
  readonly exposureMap: ExposureMap | null
  readonly totalValue: number
  readonly loading: boolean
}

function formatPortfolioValue(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface Narrative {
  readonly headline: string
  readonly subtext: string
  readonly tone: 'alert' | 'warning' | 'healthy'
  readonly showCta: boolean
}

function generateNarrative(
  healthScore: HealthScore | null,
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap | null,
): Narrative {
  // Priority 1: Active high/critical signals
  const materialSignals = signals.filter((s) => s.urgency === 'critical' || s.urgency === 'high')
  if (materialSignals.length > 0) {
    const topSignal = materialSignals[0]
    const affectedPct = exposureMap
      ? exposureMap.exposures
          .filter((e) => topSignal.affectedExposures.some((ae) =>
            e.category.toLowerCase().includes(ae.toLowerCase()),
          ))
          .reduce((sum, e) => sum + e.percentage, 0)
      : 0

    return {
      headline: affectedPct > 0
        ? `A live event is affecting ${affectedPct.toFixed(0)}% of your portfolio.`
        : topSignal.headline,
      subtext: 'Tap a signal card below to see how it flows through your holdings.',
      tone: 'alert',
      showCta: true,
    }
  }

  // Priority 2: Medium signals exist
  const mediumSignals = signals.filter((s) => s.urgency === 'medium')
  if (mediumSignals.length > 0) {
    return {
      headline: `${mediumSignals.length} market event${mediumSignals.length > 1 ? 's' : ''} may affect your holdings.`,
      subtext: 'Review the signals below for details on potential impact.',
      tone: 'warning',
      showCta: true,
    }
  }

  // Priority 3: Concentration warnings
  if (exposureMap && exposureMap.warnings.length > 0) {
    const critical = exposureMap.warnings.filter((w) => w.severity === 'critical' || w.severity === 'high')
    if (critical.length > 0) {
      const largest = critical.reduce((max, w) => w.percentage > max.percentage ? w : max, critical[0])
      return {
        headline: `${critical.length} hidden concentration${critical.length > 1 ? 's' : ''} detected. ${largest.category} is ${largest.percentage.toFixed(0)}% of your portfolio.`,
        subtext: 'Concentration increases vulnerability to sector-specific shocks.',
        tone: 'warning',
        showCta: false,
      }
    }
  }

  // Priority 4: Default healthy
  const sectorCount = exposureMap?.exposures.length ?? 0
  const grade = healthScore?.grade ?? '—'

  return {
    headline: `Portfolio health: ${grade}. ${sectorCount} sectors across your holdings.`,
    subtext: 'Prism is monitoring live market events for anything that could affect your portfolio.',
    tone: 'healthy',
    showCta: false,
  }
}

function scrollToSignals() {
  const el = document.getElementById('signal-cards')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

export function IntelligenceBriefing({
  healthScore,
  signals,
  exposureMap,
  totalValue,
  loading,
}: IntelligenceBriefingProps) {
  if (loading) {
    return (
      <section className="intelligence-briefing intelligence-briefing--loading">
        <span className="skeleton-pulse" style={{ width: 180, height: 32 }} />
        <span className="skeleton-pulse" style={{ width: '60%', height: 16, marginTop: 8 }} />
      </section>
    )
  }

  const narrative = generateNarrative(healthScore, signals, exposureMap)

  return (
    <section className={`intelligence-briefing intelligence-briefing--${narrative.tone}`}>
      <div className="intelligence-briefing__value">
        {formatPortfolioValue(totalValue)} CAD
      </div>
      <p className="intelligence-briefing__headline">
        {narrative.headline}
      </p>
      <p className="intelligence-briefing__subtext">
        {narrative.subtext}
      </p>
      {narrative.showCta && (
        <button
          type="button"
          className="intelligence-briefing__cta"
          onClick={scrollToSignals}
        >
          See what's happening
        </button>
      )}
    </section>
  )
}
