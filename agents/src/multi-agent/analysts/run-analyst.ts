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
import { buildAnalystPrompt } from './shared-prompt.js'
import { createGeminiChatModel } from '../../utils/gemini-chat-model'

// ── Gemini Configuration ────────────────────────────────────
function createAnalystModel() {
  return createGeminiChatModel({
    model: 'gemini-2.5-flash',
    temperature: 0.3, // Low temp for analytical consistency
    maxOutputTokens: 4096,
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

// ── Run Single Analyst ──────────────────────────────────────
export async function runAnalyst(params: {
  readonly analystType: AnalystType
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData?: MarketDataBundle
}): Promise<AnalystAssessment> {
  const { analystType } = params

  const prompt = buildAnalystPrompt(params)
  const model = createAnalystModel()

  // Invoke Gemini with the analyst prompt
  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  // Parse and validate with Zod (retry once on failure)
  const jsonStr = extractJson(responseText)
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(
      `${analystType} analyst returned invalid JSON: ${jsonStr.slice(0, 200)}`,
    )
  }

  // Validate with Zod — retry with feedback if validation fails
  const result = AnalystAssessmentSchema.safeParse(parsed)

  if (result.success) {
    return result.data
  }

  // Retry once with validation error feedback
  const retryPrompt =
    `Your previous response had validation errors:\n${result.error.message}\n\n` +
    `Please fix these issues and respond with valid JSON. Original prompt:\n${prompt}`

  const retryResponse = await model.invoke([new HumanMessage(retryPrompt)])
  const retryText = typeof retryResponse.content === 'string'
    ? retryResponse.content
    : Array.isArray(retryResponse.content)
      ? retryResponse.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  const retryJson = extractJson(retryText)
  const retryParsed = JSON.parse(retryJson)
  const retryResult = AnalystAssessmentSchema.safeParse(retryParsed)

  if (retryResult.success) {
    return retryResult.data
  }

  throw new Error(
    `${analystType} analyst failed validation after retry: ${retryResult.error.message}`,
  )
}

// ── Run All Analysts in Parallel ────────────────────────────
export async function runAllAnalysts(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData?: MarketDataBundle
}): Promise<readonly AnalystAssessment[]> {
  const analystTypes: readonly AnalystType[] = ['macro', 'fundamental', 'sentiment', 'technical']

  const results = await Promise.all(
    analystTypes.map((analystType) =>
      runAnalyst({ ...params, analystType }),
    ),
  )

  return results
}
