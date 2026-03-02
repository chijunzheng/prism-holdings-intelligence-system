// Judge Agent — quality evaluator for Fund Manager verdicts.
// Scores 5 dimensions, triggers re-synthesis if quality < 0.65 (max 2 iterations).

import { HumanMessage } from '@langchain/core/messages'
import type {
  JudgeVerdict,
  FundManagerVerdict,
  AnalystAssessment,
  Signal,
} from '@prism/shared'
import { JudgeVerdictSchema } from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { parseJsonSafe } from '../utils/json-parse.js'

const DIMENSION_WEIGHTS = {
  evidenceGrounding: 0.25,
  assumptionQuality: 0.20,
  magnitudeCalibration: 0.25,
  internalConsistency: 0.15,
  completeness: 0.15,
} as const

const CONVERGENCE_THRESHOLD = 0.65

// ── Pure computation: weighted quality score ────────────────
export function computeOverallQuality(scores: {
  readonly evidenceGrounding: number
  readonly assumptionQuality: number
  readonly magnitudeCalibration: number
  readonly internalConsistency: number
  readonly completeness: number
}): number {
  return (
    scores.evidenceGrounding * DIMENSION_WEIGHTS.evidenceGrounding +
    scores.assumptionQuality * DIMENSION_WEIGHTS.assumptionQuality +
    scores.magnitudeCalibration * DIMENSION_WEIGHTS.magnitudeCalibration +
    scores.internalConsistency * DIMENSION_WEIGHTS.internalConsistency +
    scores.completeness * DIMENSION_WEIGHTS.completeness
  )
}

// ── Public API ──────────────────────────────────────────────
export async function runJudge(params: {
  readonly verdict: FundManagerVerdict
  readonly signal: Signal
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly iteration: number
}): Promise<JudgeVerdict> {
  const { verdict, signal, analystAssessments, iteration } = params

  const model = createGeminiChatModel({
    model: 'gemini-3-flash-preview',
    temperature: 0.1, // Low temp for consistent scoring
    maxOutputTokens: 2048,
  })

  const holdingTickers = verdict.holdingImpacts.map((h) => h.ticker)
  const analystTickers = [...new Set(
    analystAssessments.flatMap((a) => a.holdingImpacts.map((h) => h.ticker)),
  )]
  const coveredTickers = holdingTickers.filter((t) => analystTickers.includes(t))
  const missingTickers = analystTickers.filter((t) => !holdingTickers.includes(t))

  const prompt = `You are a quality evaluator for a financial analysis pipeline.
Score the following Fund Manager verdict on 5 dimensions, each 0.0 to 1.0.

SIGNAL: ${signal.headline}
ITERATION: ${iteration + 1} of max 2

--- VERDICT TO EVALUATE ---
Holdings analyzed: ${holdingTickers.join(', ')}
Quality score self-reported: ${verdict.qualityScore.toFixed(2)}
Recommendations: ${verdict.recommendations.length} options provided
Risk adjustments: confidence haircut ${(verdict.riskAdjustments.confidenceHaircut * 100).toFixed(0)}%, magnitude bounds applied to ${verdict.riskAdjustments.magnitudeBoundsApplied.length} holdings
Perspectives: bull case provided: ${verdict.perspectiveBreakdown.bullCase.length > 10}, bear case provided: ${verdict.perspectiveBreakdown.bearCase.length > 10}
Unresolved disagreements: ${verdict.perspectiveBreakdown.unresolvedDisagreements.length}

--- ANALYST COVERAGE ---
Analysts covered tickers: ${analystTickers.join(', ')}
Verdict covered tickers: ${coveredTickers.join(', ')}
Missing from verdict: ${missingTickers.length > 0 ? missingTickers.join(', ') : 'none'}

--- HOLDING IMPACTS ---
${verdict.holdingImpacts.map((h) =>
  `${h.ticker}: direction=${h.direction.toFixed(2)}, confidence=${h.confidence.toFixed(2)}, 1M mid=$${h.impact['1M']?.mid ?? 'N/A'}, derivation="${h.derivation}"`
).join('\n')}

--- SCORING CRITERIA ---
1. evidenceGrounding (weight 0.25): Are derivations grounded in data (volatility, market prices)? Are sources cited? Score low if derivations are vague or hallucinated.
2. assumptionQuality (weight 0.20): Were analyst assumptions challenged by the risk team? Is there a confidence haircut applied? Score low if no challenges were made.
3. magnitudeCalibration (weight 0.25): Are dollar estimates within reasonable bounds? Were out-of-bounds estimates clamped? Score low if estimates seem extreme.
4. internalConsistency (weight 0.15): Do holding directions align with the overall consensus? Are disagreements acknowledged? Score low if contradictions exist.
5. completeness (weight 0.15): Were all analyst-identified holdings addressed? Are recommendations provided? Score low if holdings are missing.

Respond with valid JSON:
{
  "evidenceGrounding": 0.0-1.0,
  "assumptionQuality": 0.0-1.0,
  "magnitudeCalibration": 0.0-1.0,
  "internalConsistency": 0.0-1.0,
  "completeness": 0.0-1.0,
  "feedback": "If any dimension < 0.5, explain what needs improvement. Otherwise omit or set to null."
}`

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    const parsed = parseJsonSafe(responseText)

    const scores = {
      evidenceGrounding: clamp01(parsed.evidenceGrounding ?? 0.5),
      assumptionQuality: clamp01(parsed.assumptionQuality ?? 0.5),
      magnitudeCalibration: clamp01(parsed.magnitudeCalibration ?? 0.5),
      internalConsistency: clamp01(parsed.internalConsistency ?? 0.5),
      completeness: clamp01(parsed.completeness ?? 0.5),
    }

    const overallQualityScore = computeOverallQuality(scores)
    const convergenceReached = overallQualityScore >= CONVERGENCE_THRESHOLD

    const result: JudgeVerdict = {
      ...scores,
      overallQualityScore,
      convergenceReached,
      feedback: convergenceReached ? undefined : (parsed.feedback ?? generateFeedback(scores)),
    }

    return JudgeVerdictSchema.parse(result)
  } catch (error) {
    // Fallback: compute from structural signals without LLM
    console.error('[Judge] LLM evaluation failed, using structural fallback:', error instanceof Error ? error.message : error)
    return computeFallbackVerdict(verdict, analystTickers, holdingTickers)
  }
}

// ── Helpers ─────────────────────────────────────────────────
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function generateFeedback(scores: Record<string, number>): string {
  const weak = Object.entries(scores)
    .filter(([, v]) => v < 0.5)
    .map(([k]) => k)

  if (weak.length === 0) return 'Marginal quality — consider strengthening evidence citations.'
  return `Low scores on: ${weak.join(', ')}. Focus on improving these dimensions.`
}

export function computeFallbackVerdict(
  verdict: FundManagerVerdict,
  analystTickers: readonly string[],
  verdictTickers: readonly string[],
): JudgeVerdict {
  // Evidence: check derivations exist and mention data sources
  const derivationsWithData = verdict.holdingImpacts.filter(
    (h) => h.derivation && h.derivation.length > 20,
  ).length
  const evidenceGrounding = verdictTickers.length > 0
    ? clamp01(derivationsWithData / verdictTickers.length)
    : 0.3

  // Assumptions: check that risk adjustments were applied
  const hasHaircut = verdict.riskAdjustments.confidenceHaircut !== 0
  const hasBounds = verdict.riskAdjustments.magnitudeBoundsApplied.length > 0
  const assumptionQuality = hasHaircut ? (hasBounds ? 0.8 : 0.6) : 0.3

  // Magnitude: check no extreme values (>$100K for a single holding monthly)
  const extremeImpacts = verdict.holdingImpacts.filter(
    (h) => Math.abs(h.impact['1M']?.mid ?? 0) > 100_000,
  ).length
  const magnitudeCalibration = extremeImpacts === 0 ? 0.7 : 0.3

  // Consistency: check directions align
  const directions = verdict.holdingImpacts.map((h) => Math.sign(h.direction))
  const allSameDirection = new Set(directions).size <= 1
  const internalConsistency = allSameDirection ? 0.6 : 0.7 // Mixed is fine, means nuance

  // Completeness: coverage of analyst tickers
  const coverage = analystTickers.length > 0
    ? verdictTickers.filter((t) => analystTickers.includes(t)).length / analystTickers.length
    : 0.5
  const completeness = clamp01(coverage)

  const scores = { evidenceGrounding, assumptionQuality, magnitudeCalibration, internalConsistency, completeness }
  const overallQualityScore = computeOverallQuality(scores)
  const convergenceReached = overallQualityScore >= CONVERGENCE_THRESHOLD

  return {
    ...scores,
    overallQualityScore,
    convergenceReached,
    feedback: convergenceReached ? undefined : generateFeedback(scores),
  }
}
