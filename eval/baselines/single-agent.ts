// Single-agent baseline — one Gemini call for direction + impact estimate.
// Used as the comparison baseline against the multi-agent pipeline.

import { z } from 'zod'
import type { Signal, Portfolio, ExposureMap } from '@prism/shared'
import { createGeminiChatModel } from '../../agents/src/utils/gemini-chat-model'
import { formatExposureSummary } from './exposure-summary'

const SingleAgentResponseSchema = z.object({
  direction: z.enum(['positive', 'negative', 'mixed']),
  confidenceLow: z.number(),
  confidenceHigh: z.number(),
  reasoning: z.string(),
  perHolding: z.array(z.object({
    ticker: z.string(),
    direction: z.number().min(-1).max(1),
  })),
})

export type SingleAgentResponse = z.infer<typeof SingleAgentResponseSchema>

const SYSTEM_PROMPT = `You are a financial analyst. Given a market signal and a portfolio, estimate the directional impact and dollar range.

Respond ONLY with valid JSON matching this schema:
{
  "direction": "positive" | "negative" | "mixed",
  "confidenceLow": number (dollar impact lower bound, negative for losses),
  "confidenceHigh": number (dollar impact upper bound),
  "reasoning": "1-2 sentence explanation",
  "perHolding": [{ "ticker": "XYZ", "direction": -1 to 1 }]
}

Guidelines:
- Dollar impacts should be realistic for the portfolio size
- Use negative numbers for losses
- Consider which ETFs/stocks are directly affected by the signal
- "mixed" direction means some holdings benefit while others lose`

export async function runSingleAgentBaseline(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly model?: string
}): Promise<SingleAgentResponse> {
  const { signal, portfolio, exposureMap, model = 'gemini-3-flash-preview' } = params

  const holdingsSummary = portfolio.accounts
    .flatMap((a) => a.holdings)
    .map((h) => `${h.ticker}: $${h.valueCad.toLocaleString()}`)
    .join('\n')

  const exposureSummary = formatExposureSummary(exposureMap)

  const prompt = `Signal: ${signal.headline}
Description: ${signal.description}
Affected exposures: ${signal.affectedExposures.join(', ')}

Portfolio ($${portfolio.totalValueCad.toLocaleString()} total):
${holdingsSummary}

Exposure Map:
${exposureSummary}

Estimate the directional impact and dollar range for this portfolio.`

  const llm = createGeminiChatModel({
    model,
    temperature: 0.3,
  })

  const response = await llm.invoke([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ])

  const text = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content)

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // Fallback: return a conservative estimate
    return {
      direction: 'mixed',
      confidenceLow: -portfolio.totalValueCad * 0.02,
      confidenceHigh: portfolio.totalValueCad * 0.01,
      reasoning: 'Failed to parse LLM response — using conservative estimate',
      perHolding: [],
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return SingleAgentResponseSchema.parse(parsed)
  } catch {
    return {
      direction: 'mixed',
      confidenceLow: -portfolio.totalValueCad * 0.02,
      confidenceHigh: portfolio.totalValueCad * 0.01,
      reasoning: 'Failed to validate LLM response — using conservative estimate',
      perHolding: [],
    }
  }
}
