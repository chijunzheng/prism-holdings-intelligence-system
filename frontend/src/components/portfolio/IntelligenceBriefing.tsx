import { Link } from 'react-router-dom'
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

interface CoverageSummary {
  readonly coveragePct: number
  readonly matchedExposureCount: number
  readonly topExposureCategory: string | null
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function matchesExposure(affectedExposure: string, exposureCategory: string): boolean {
  const affected = normalizeLabel(affectedExposure)
  const category = normalizeLabel(exposureCategory)
  return affected.includes(category) || category.includes(affected)
}

function computeCoverageSummary(
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap | null,
): CoverageSummary | null {
  if (!exposureMap || signals.length === 0) return null

  const matched = exposureMap.exposures.filter((exposure) =>
    signals.some((signal) =>
      signal.affectedExposures.some((affected) => matchesExposure(affected, exposure.category)),
    ),
  )

  if (matched.length === 0) return null

  const coveragePct = Math.min(
    100,
    matched.reduce((sum, exposure) => sum + exposure.percentage, 0),
  )
  const topExposure = [...matched].sort((a, b) => b.percentage - a.percentage)[0]

  return {
    coveragePct,
    matchedExposureCount: matched.length,
    topExposureCategory: topExposure?.category ?? null,
  }
}

function generateNarrative(
  healthScore: HealthScore | null,
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap | null,
): Narrative {
  // Priority 1: Active high/critical signals
  const materialSignals = signals
    .filter((s) => s.urgency === 'critical' || s.urgency === 'high')
    .sort((a, b) => b.relevanceScore - a.relevanceScore)

  if (materialSignals.length > 0) {
    const coverage = computeCoverageSummary(materialSignals, exposureMap)
    const signalCount = materialSignals.length
    const signalLabel = `${signalCount} live signal${signalCount > 1 ? 's' : ''}`
    const verb = signalCount > 1 ? 'touch' : 'touches'
    const coverageText = coverage ? `${coverage.coveragePct.toFixed(0)}%` : 'key parts'
    const topExposureText = coverage?.topExposureCategory
      ? `, led by ${coverage.topExposureCategory}`
      : ''

    return {
      headline: `${signalLabel} currently ${verb} ${coverageText} of your portfolio${topExposureText}.`,
      subtext: coverage
        ? `Coverage reflects the combined exposure footprint of active high-priority signals across ${coverage.matchedExposureCount} exposure bucket${coverage.matchedExposureCount > 1 ? 's' : ''}.`
        : 'High-priority live signals are active; open Impact Analysis for full causal pathways and actions.',
      tone: 'alert',
      showCta: true,
    }
  }

  // Priority 2: Medium signals exist
  const mediumSignals = signals.filter((s) => s.urgency === 'medium')
  if (mediumSignals.length > 0) {
    const coverage = computeCoverageSummary(mediumSignals, exposureMap)
    const verb = mediumSignals.length > 1 ? 'are monitoring' : 'is monitoring'
    const coverageText = coverage ? `${coverage.coveragePct.toFixed(0)}%` : 'parts'
    return {
      headline: `${mediumSignals.length} live signal${mediumSignals.length > 1 ? 's' : ''} ${verb} ${coverageText} of your portfolio exposure.`,
      subtext: 'Potential effects are moderate; review signal drill-downs for path-level detail.',
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
        <Link to="/signals" className="intelligence-briefing__cta">
          Review live impact
        </Link>
      )}
    </section>
  )
}
