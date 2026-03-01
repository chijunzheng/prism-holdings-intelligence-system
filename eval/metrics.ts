// Evaluation metrics — directional accuracy, range coverage, evidence grounding.
// All functions are pure computation (no LLM calls).

import type { EvalResult, EventType, SystemMetrics } from './types'

// ── Directional Accuracy ───────────────────────────────────
// Did the system predict the correct direction of market impact?

/** Neutral threshold — moves < 0.5% are considered neutral */
const NEUTRAL_THRESHOLD = 0.005

export function classifyActualDirection(
  returns5d: Readonly<Record<string, number>>,
): 'positive' | 'negative' | 'neutral' {
  const values = Object.values(returns5d)
  if (values.length === 0) return 'neutral'

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  if (avg > NEUTRAL_THRESHOLD) return 'positive'
  if (avg < -NEUTRAL_THRESHOLD) return 'negative'
  return 'neutral'
}

export function isDirectionallyAccurate(
  predicted: 'positive' | 'negative' | 'mixed',
  actual: 'positive' | 'negative' | 'neutral',
): boolean {
  if (actual === 'neutral') return true // Any prediction is "correct" for near-zero moves
  if (predicted === 'mixed') return actual === 'neutral' // Mixed only matches genuinely ambiguous moves
  return predicted === actual
}

/** Per-holding directional accuracy — fraction of holdings where predicted direction matches */
export function holdingDirectionalAccuracy(
  holdingDirections: ReadonlyMap<string, number>,
  actualReturns: Readonly<Record<string, number>>,
): number {
  let correct = 0
  let total = 0

  for (const [ticker, predictedDirection] of holdingDirections) {
    const actualReturn = actualReturns[ticker]
    if (actualReturn === undefined) continue

    total++
    if (Math.abs(actualReturn) < NEUTRAL_THRESHOLD) {
      correct++ // Neutral actual is always "correct"
    } else if (predictedDirection > 0 && actualReturn > 0) {
      correct++
    } else if (predictedDirection < 0 && actualReturn < 0) {
      correct++
    } else if (Math.abs(predictedDirection) < 0.1) {
      correct++ // Near-zero predicted direction is tolerant
    }
  }

  return total === 0 ? 0 : correct / total
}

// ── Confidence Range Coverage ──────────────────────────────
// Was the actual dollar impact within the predicted confidence range?

export function isWithinRange(
  predicted: { readonly low: number; readonly high: number },
  actual: number,
): boolean {
  return actual >= predicted.low && actual <= predicted.high
}

/** Compute range coverage across all events for one system */
export function computeRangeCoverage(results: readonly EvalResult[], system: 'multiAgent' | 'singleAgent'): number {
  let covered = 0
  let total = 0

  for (const result of results) {
    const prediction = result[system]
    const actualReturns = result.actual.returns5d

    // Convert actual returns to approximate dollar impact using a reference portfolio value
    // We use the sum of absolute returns as a proxy
    const actualNetReturn = Object.values(actualReturns).reduce((sum, r) => sum + r, 0)
    const referencePortfolioValue = 60000 // Eval portfolio (Sarah's diversified portfolio)
    const actualDollarImpact = actualNetReturn * referencePortfolioValue

    if (isWithinRange(prediction.dollarImpactRange, actualDollarImpact)) {
      covered++
    }
    total++
  }

  return total === 0 ? 0 : covered / total
}

// ── Aggregate Metrics ──────────────────────────────────────

export function computeDirectionalAccuracy(results: readonly EvalResult[], system: 'multiAgent' | 'singleAgent'): number {
  let correct = 0
  let total = 0

  for (const result of results) {
    const predicted = result[system].direction
    const actual = result.actual.netDirection
    if (isDirectionallyAccurate(predicted, actual)) {
      correct++
    }
    total++
  }

  return total === 0 ? 0 : correct / total
}

export function computePerEventTypeMetrics(
  results: readonly EvalResult[],
  system: 'multiAgent' | 'singleAgent',
): ReadonlyMap<EventType, { accuracy: number; coverage: number }> {
  const grouped = new Map<EventType, EvalResult[]>()

  for (const result of results) {
    const existing = grouped.get(result.eventType) ?? []
    grouped.set(result.eventType, [...existing, result])
  }

  const metrics = new Map<EventType, { accuracy: number; coverage: number }>()

  for (const [eventType, group] of grouped) {
    metrics.set(eventType, {
      accuracy: computeDirectionalAccuracy(group, system),
      coverage: computeRangeCoverage(group, system),
    })
  }

  return metrics
}

export function computeSystemMetrics(
  results: readonly EvalResult[],
  system: 'multiAgent' | 'singleAgent',
): SystemMetrics {
  const directionalAccuracy = computeDirectionalAccuracy(results, system)
  const rangeCoverage = computeRangeCoverage(results, system)
  const perEventType = computePerEventTypeMetrics(results, system)

  // Evidence grounding — average across events that have it
  const groundingScores = results
    .map((r) => system === 'multiAgent' ? r.multiAgent.evidenceGroundingScore : undefined)
    .filter((s): s is number => s !== undefined)

  const evidenceGrounding = groundingScores.length > 0
    ? groundingScores.reduce((sum, s) => sum + s, 0) / groundingScores.length
    : 0

  return { directionalAccuracy, rangeCoverage, evidenceGrounding, perEventType }
}
