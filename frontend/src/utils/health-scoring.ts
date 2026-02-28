import type { ExposureMap, Signal } from '@prism/shared'
import type { HealthScore, LetterGrade, SubScore } from '@prism/shared'

// ── Grade Thresholds ─────────────────────────────────────
const GRADE_THRESHOLDS: ReadonlyArray<readonly [number, LetterGrade]> = [
  [93, 'A+'], [87, 'A'], [83, 'A-'],
  [80, 'B+'], [73, 'B'], [70, 'B-'],
  [67, 'C+'], [60, 'C'], [57, 'C-'],
  [53, 'D+'], [47, 'D'], [40, 'D-'],
  [0, 'F'],
] as const

// ── Weights ──────────────────────────────────────────────
const WEIGHTS = {
  diversification: 0.35,
  concentration: 0.30,
  overlap: 0.25,
  freshness: 0.10,
} as const

// ── Pure Scoring Functions ───────────────────────────────

export function mapToGrade(composite: number): LetterGrade {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (composite >= threshold) return grade
  }
  return 'F'
}

/**
 * Diversification score based on Herfindahl-Hirschman Index (HHI).
 * HHI = sum of squared percentage shares (each as fraction 0-1).
 * Perfect diversification across N sectors → HHI = 1/N.
 * Score: 100 * (1 - HHI) normalized so 10+ sectors with even spread = ~95+.
 */
export function scoreDiversification(exposures: ExposureMap['exposures']): SubScore {
  if (exposures.length === 0) {
    return {
      dimension: 'diversification',
      score: 0,
      insight: 'No exposure data available',
    }
  }

  const totalPct = exposures.reduce((sum, e) => sum + e.percentage, 0)
  if (totalPct === 0) {
    return { dimension: 'diversification', score: 0, insight: 'No exposure data available' }
  }

  // Compute HHI using fractions of tracked total
  const hhi = exposures.reduce((sum, e) => {
    const share = e.percentage / totalPct
    return sum + share * share
  }, 0)

  // HHI ranges from 1/N (perfect) to 1 (single sector)
  // Map to 0-100: score = (1 - hhi) / (1 - 1/N) * 100, clamped
  const n = exposures.length
  const minHhi = 1 / n
  const raw = n > 1 ? ((1 - hhi) / (1 - minHhi)) * 100 : 0
  const score = Math.round(Math.min(100, Math.max(0, raw)))

  const insight = n <= 3
    ? `Only ${n} sector${n === 1 ? '' : 's'} detected — limited diversification`
    : score >= 80
      ? `${n} sectors with reasonable spread`
      : `${n} sectors but unevenly distributed`

  return { dimension: 'diversification', score, insight }
}

/**
 * Concentration score — penalizes high-severity warnings.
 * Starts at 100, deducts per warning based on severity.
 */
export function scoreConcentration(warnings: ExposureMap['warnings']): SubScore {
  if (warnings.length === 0) {
    return {
      dimension: 'concentration',
      score: 100,
      insight: 'No concentration warnings',
    }
  }

  const severityPenalty: Record<string, number> = {
    critical: 30,
    high: 20,
    medium: 10,
    low: 5,
  }

  const totalPenalty = warnings.reduce(
    (sum, w) => sum + (severityPenalty[w.severity] ?? 5),
    0,
  )
  const score = Math.max(0, Math.round(100 - totalPenalty))

  const criticalCount = warnings.filter((w) => w.severity === 'critical').length
  const highCount = warnings.filter((w) => w.severity === 'high').length
  const above20 = warnings.filter((w) => w.percentage >= 20).length

  const insight = criticalCount > 0
    ? `${criticalCount} critical concentration${criticalCount > 1 ? 's' : ''} detected`
    : highCount > 0
      ? `${highCount} high concentration${highCount > 1 ? 's' : ''} above threshold`
      : `${above20} sector${above20 !== 1 ? 's' : ''} above 20% threshold`

  return { dimension: 'concentration', score, insight }
}

/**
 * Overlap score — penalizes assets held across multiple ETFs.
 * Total overlap percentage = sum of all overlap totalPercentage values.
 */
export function scoreOverlap(overlaps: ExposureMap['overlaps']): SubScore {
  if (overlaps.length === 0) {
    return {
      dimension: 'overlap',
      score: 100,
      insight: 'No overlapping holdings detected',
    }
  }

  const totalOverlapPct = overlaps.reduce((sum, o) => sum + o.totalPercentage, 0)
  // Penalize: >20% overlap = score drops significantly
  const raw = 100 - totalOverlapPct * 3
  const score = Math.max(0, Math.min(100, Math.round(raw)))

  const insight = overlaps.length === 1
    ? `1 asset held across multiple ETFs (${totalOverlapPct.toFixed(1)}% overlap)`
    : `${overlaps.length} assets overlap across ETFs (${totalOverlapPct.toFixed(1)}% total)`

  return { dimension: 'overlap', score, insight }
}

/**
 * Freshness score — penalizes stale fund data.
 */
export function scoreFreshness(dataFreshness: ExposureMap['dataFreshness']): SubScore {
  if (dataFreshness.allFresh) {
    return {
      dimension: 'freshness',
      score: 100,
      insight: 'All fund data is current',
    }
  }

  const staleCount = dataFreshness.staleFunds.length
  const score = Math.max(0, 100 - staleCount * 25)

  return {
    dimension: 'freshness',
    score,
    insight: `${staleCount} fund${staleCount > 1 ? 's' : ''} have stale data`,
  }
}

/**
 * Signal stress penalty — reduces health when active signals
 * hit concentrated or poorly diversified sectors.
 *
 * Penalty based on:
 * - Number of active signals (more signals = more stress)
 * - Signal urgency (critical/high = larger penalty)
 * - Whether signals hit concentrated sectors (amplification)
 */
function computeSignalStressPenalty(
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap,
): number {
  if (signals.length === 0) return 0

  const urgencyPenalty: Record<string, number> = {
    critical: 6,
    high: 4,
    medium: 2,
    low: 1,
  }

  let basePenalty = 0
  for (const signal of signals) {
    basePenalty += urgencyPenalty[signal.urgency] ?? 1
  }

  // Amplify if signals hit concentrated sectors
  const concentratedCategories = new Set(
    exposureMap.warnings
      .filter((w) => w.severity === 'critical' || w.severity === 'high')
      .map((w) => w.category.toLowerCase()),
  )

  let amplification = 1
  if (concentratedCategories.size > 0) {
    const hitsConcentrated = signals.some((signal) =>
      signal.affectedExposures.some((ae) =>
        [...concentratedCategories].some((cat) =>
          cat.includes(ae.toLowerCase()) || ae.toLowerCase().includes(cat),
        ),
      ),
    )
    if (hitsConcentrated) {
      amplification = 1.5
    }
  }

  return Math.round(basePenalty * amplification)
}

/**
 * Compute the full portfolio health score from an ExposureMap.
 * When signals are provided, the score is dynamically adjusted
 * based on signal stress (more/higher urgency signals hitting
 * concentrated sectors = lower health).
 *
 * Pure function — no side effects or LLM calls.
 */
export function computeHealthScore(
  exposureMap: ExposureMap,
  signals: ReadonlyArray<Signal> = [],
): HealthScore {
  const diversification = scoreDiversification(exposureMap.exposures)
  const concentration = scoreConcentration(exposureMap.warnings)
  const overlap = scoreOverlap(exposureMap.overlaps)
  const freshness = scoreFreshness(exposureMap.dataFreshness)

  const structuralComposite = Math.round(
    WEIGHTS.diversification * diversification.score +
    WEIGHTS.concentration * concentration.score +
    WEIGHTS.overlap * overlap.score +
    WEIGHTS.freshness * freshness.score,
  )

  const signalPenalty = computeSignalStressPenalty(signals, exposureMap)
  const composite = Math.max(0, Math.min(100, structuralComposite - signalPenalty))

  return {
    composite,
    grade: mapToGrade(composite),
    subScores: { diversification, concentration, overlap, freshness },
    computedAt: new Date().toISOString(),
  }
}
