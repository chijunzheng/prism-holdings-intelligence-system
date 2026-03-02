// Evaluation metrics — directional accuracy, range coverage, evidence grounding, judge scores.
// All functions are pure computation (no LLM calls).

import type { EvalResult, EventType, JudgeScore, SystemKey, SystemMetrics } from './types'

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
export function computeRangeCoverage(results: readonly EvalResult[], system: SystemKey): number {
  let covered = 0
  let total = 0

  for (const result of results) {
    const prediction = result[system]
    const actualReturns = result.actual.returns5d

    // Convert actual returns to approximate dollar impact.
    // Each holding is worth ~$10k (6 holdings × $10k = $60k portfolio).
    // Each return applies to one holding, so multiply each by per-holding value.
    const holdingValues = Object.values(actualReturns)
    const perHoldingValue = holdingValues.length > 0 ? 60000 / holdingValues.length : 10000
    const actualDollarImpact = holdingValues.reduce((sum, r) => sum + r * perHoldingValue, 0)

    if (isWithinRange(prediction.dollarImpactRange, actualDollarImpact)) {
      covered++
    }
    total++
  }

  return total === 0 ? 0 : covered / total
}

// ── Aggregate Metrics ──────────────────────────────────────

export function computeDirectionalAccuracy(results: readonly EvalResult[], system: SystemKey): number {
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
  system: SystemKey,
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

// ── Judge Score Averaging ──────────────────────────────────

export function computeAverageJudgeScore(
  results: readonly EvalResult[],
  system: SystemKey,
): JudgeScore | undefined {
  const scores = results
    .map((r) => r[system].judgeScore)
    .filter((s): s is JudgeScore => s !== undefined)

  if (scores.length === 0) return undefined

  const sum = scores.reduce(
    (acc, s) => ({
      causalReasoning: acc.causalReasoning + s.causalReasoning,
      calibration: acc.calibration + s.calibration,
      riskIdentification: acc.riskIdentification + s.riskIdentification,
      recommendationQuality: acc.recommendationQuality + s.recommendationQuality,
      transparency: acc.transparency + s.transparency,
      overall: acc.overall + s.overall,
    }),
    { causalReasoning: 0, calibration: 0, riskIdentification: 0, recommendationQuality: 0, transparency: 0, overall: 0 },
  )

  const n = scores.length
  const round = (v: number) => Math.round((v / n) * 100) / 100

  return {
    causalReasoning: round(sum.causalReasoning),
    calibration: round(sum.calibration),
    riskIdentification: round(sum.riskIdentification),
    recommendationQuality: round(sum.recommendationQuality),
    transparency: round(sum.transparency),
    overall: round(sum.overall),
  }
}

// ── System Metrics Builder ──────────────────────────────────

export function computeSystemMetrics(
  results: readonly EvalResult[],
  system: SystemKey,
): SystemMetrics {
  const directionalAccuracy = computeDirectionalAccuracy(results, system)
  const rangeCoverage = computeRangeCoverage(results, system)
  const perEventType = computePerEventTypeMetrics(results, system)

  // Evidence grounding — average across events that have it (multi-agent only)
  const groundingScores = results
    .map((r) => system === 'multiAgent' ? r.multiAgent.evidenceGroundingScore : undefined)
    .filter((s): s is number => s !== undefined)

  const evidenceGrounding = groundingScores.length > 0
    ? groundingScores.reduce((sum, s) => sum + s, 0) / groundingScores.length
    : 0

  const averageJudgeScore = computeAverageJudgeScore(results, system)

  return { directionalAccuracy, rangeCoverage, evidenceGrounding, perEventType, averageJudgeScore }
}
