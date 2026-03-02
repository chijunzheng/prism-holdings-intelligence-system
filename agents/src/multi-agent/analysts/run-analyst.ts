// Core analyst runner — invokes Gemini Flash with Search grounding
// and parses the response into a validated AnalystAssessment.

import { HumanMessage } from '@langchain/core/messages'
import {
  AnalystAssessmentSchema,
  type AnalystAssessment,
  type AnalystType,
  type Signal,
  type Portfolio,
  type ExposureMap,
  type InferredRiskProfile,
  type MarketDataBundle,
} from '@prism/shared'
import type { ThinkingCallback } from '../types.js'
import { buildAnalystPrompt, buildSharedAnalystContext, buildAnalystSpecificPrompt } from './shared-prompt.js'
import { createGeminiChatModel } from '../../utils/gemini-chat-model'

// ── Gemini Configuration ────────────────────────────────────
function createAnalystModel() {
  return createGeminiChatModel({
    model: 'gemini-3-flash-preview',
    temperature: 0.3, // Low temp for analytical consistency
    maxOutputTokens: 4096,
    json: true,
  })
}

// ── JSON Extraction ─────────────────────────────────────────
function extractJson(text: string): string {
  // Try to find JSON in markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  return text
}

function extractResponseText(content: unknown): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk !== 'object' || chunk === null || !('text' in chunk)) return ''
        const text = (chunk as { readonly text?: unknown }).text
        return typeof text === 'string' ? text : ''
      })
      .join('')
  }

  return ''
}

type AnalystResponseParseOutcome =
  | { readonly kind: 'ok', readonly data: AnalystAssessment }
  | { readonly kind: 'parse_error', readonly jsonSnippet: string }
  | { readonly kind: 'validation_error', readonly validationMessage: string }

/**
 * Reconcile overallDirection with holdingImpacts.
 * If the LLM says "positive" but most holdings have negative direction (or vice versa),
 * correct overallDirection to match the weighted majority of holding directions.
 */
function reconcileDirection(assessment: AnalystAssessment): AnalystAssessment {
  const impacts = assessment.holdingImpacts
  if (impacts.length === 0) return assessment

  // Compute weighted average direction (by magnitude)
  let weightedSum = 0
  let totalWeight = 0
  for (const h of impacts) {
    const weight = h.magnitudeScore * h.confidence
    weightedSum += h.direction * weight
    totalWeight += weight
  }
  const avgDirection = totalWeight > 0 ? weightedSum / totalWeight : 0

  // Derive what overallDirection should be from holding impacts
  const derivedDirection: AnalystAssessment['overallDirection'] =
    avgDirection > 0.15 ? 'positive'
    : avgDirection < -0.15 ? 'negative'
    : Math.abs(avgDirection) <= 0.15 && impacts.some((h) => h.direction > 0) && impacts.some((h) => h.direction < 0) ? 'mixed'
    : 'neutral'

  // Check for inconsistency
  const current = assessment.overallDirection
  const isInconsistent =
    (current === 'positive' && avgDirection < -0.1) ||
    (current === 'negative' && avgDirection > 0.1)

  if (!isInconsistent) return assessment

  // Correct overallDirection to match holdings
  return { ...assessment, overallDirection: derivedDirection }
}

function parseAndValidateAnalystResponse(responseText: string): AnalystResponseParseOutcome {
  const jsonStr = extractJson(responseText)
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { kind: 'parse_error', jsonSnippet: jsonStr.slice(0, 300) }
  }

  const result = AnalystAssessmentSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'validation_error', validationMessage: result.error.message }
  }

  // Reconcile overallDirection with holding impacts to prevent contradictions
  const reconciled = reconcileDirection(result.data)
  return { kind: 'ok', data: reconciled }
}

function buildRetryPrompt(params: {
  readonly originalPrompt: string
  readonly failure: AnalystResponseParseOutcome
}): string {
  const { originalPrompt, failure } = params
  let issueDetail = 'Unknown failure'
  if (failure.kind === 'parse_error') {
    issueDetail = `JSON parsing failed. Malformed output snippet:\n${failure.jsonSnippet}`
  } else if (failure.kind === 'validation_error') {
    issueDetail = `Schema validation failed:\n${failure.validationMessage}`
  }

  return [
    'Your previous response could not be accepted.',
    issueDetail,
    'Respond with ONLY valid JSON (no markdown, no code fences, no commentary).',
    'Ensure every required key exists and types match exactly.',
    '',
    `Original prompt:\n${originalPrompt}`,
  ].join('\n')
}

function fallbackAssessment(params: {
  readonly analystType: AnalystType
  readonly reason: string
}): AnalystAssessment {
  const { analystType, reason } = params
  const compactReason = reason.slice(0, 220)
  return {
    analystType,
    overallDirection: 'neutral',
    overallConfidence: 0.15,
    holdingImpacts: [],
    keyAssumptions: [
      `${analystType} analyst output was unavailable after JSON validation retries.`,
      'Portfolio decisions should treat this analyst perspective as low-confidence.',
    ],
    evidenceSources: ['fallback://analyst-output-unavailable'],
    reasoning: `${analystType} analyst fallback used: ${compactReason}`,
  }
}

// ── Run Single Analyst ──────────────────────────────────────
export async function runAnalyst(params: {
  readonly analystType: AnalystType
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData?: MarketDataBundle
  readonly sharedContext?: string
}): Promise<AnalystAssessment> {
  const { analystType, sharedContext } = params

  const prompt = sharedContext
    ? buildAnalystSpecificPrompt(sharedContext, analystType, params.portfolio, params.marketData)
    : buildAnalystPrompt(params)
  const model = createAnalystModel()
  let workingPrompt = prompt
  let lastFailure: AnalystResponseParseOutcome | null = null

  // Retry once for both parse and validation failures.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await model.invoke([new HumanMessage(workingPrompt)])
    const responseText = extractResponseText(response.content)
    const parsed = parseAndValidateAnalystResponse(responseText)

    if (parsed.kind === 'ok') {
      return parsed.data
    }

    lastFailure = parsed
    if (attempt === 0) {
      workingPrompt = buildRetryPrompt({
        originalPrompt: prompt,
        failure: parsed,
      })
    }
  }

  if (lastFailure?.kind === 'parse_error') {
    throw new Error(
      `${analystType} analyst returned invalid JSON after retry: ${lastFailure.jsonSnippet}`,
    )
  }

  if (lastFailure?.kind === 'validation_error') {
    throw new Error(
      `${analystType} analyst failed validation after retry: ${lastFailure.validationMessage}`,
    )
  }

  throw new Error(`${analystType} analyst response could not be parsed or validated`)
}

// ── Run All Analysts in Parallel ────────────────────────────
export async function runAllAnalysts(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData?: MarketDataBundle
  readonly onThinking?: ThinkingCallback
}): Promise<readonly AnalystAssessment[]> {
  const { onThinking, ...analystParams } = params
  const analystTypes: readonly AnalystType[] = ['macro', 'fundamental', 'sentiment', 'technical']

  // Build shared context once, reuse for all 4 analysts (4x reduction in formatting work)
  const sharedContext = buildSharedAnalystContext(analystParams)

  const results = await Promise.all(
    analystTypes.map(async (analystType) => {
      onThinking?.('analyst_complete', `${analystType} analyst: evaluating signal impact on your holdings...`)
      try {
        const result = await runAnalyst({ ...analystParams, analystType, sharedContext })
        const directionLabel = result.overallDirection === 'positive' ? 'bullish' : result.overallDirection === 'negative' ? 'bearish' : 'neutral'
        const magnitude = Math.round(result.overallConfidence * 100)
        const topHolding = result.holdingImpacts[0]
        const mechanism = result.keyAssumptions[0] ?? 'assessment complete'
        const holdingDetail = topHolding ? ` — top impact: ${topHolding.ticker}` : ''
        onThinking?.('analyst_complete', `${analystType} analyst: ${directionLabel} outlook (magnitude: ${magnitude}%)${holdingDetail}. ${mechanism}`)
        return result
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        onThinking?.('analyst_complete', `${analystType} analyst fell back to default`)
        return fallbackAssessment({ analystType, reason })
      }
    }),
  )

  return results
}
