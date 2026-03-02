// LLM-as-judge — scores system outputs on 5 quality dimensions using Gemini 3 Pro.
// Non-blocking: returns all-zero scores on parse failure so eval never crashes.

import { z } from 'zod'
import { createGeminiChatModel } from '../agents/src/utils/gemini-chat-model'
import type { JudgeScore } from './types'

// ── Types ────────────────────────────────────────────────────

export interface JudgeInput {
  readonly signal: { readonly headline: string; readonly description: string }
  readonly system: string
  readonly direction: 'positive' | 'negative' | 'mixed'
  readonly dollarRange: { readonly low: number; readonly high: number }
  readonly reasoning: string
  readonly actualDirection: 'positive' | 'negative' | 'neutral'
}

// ── Zod Schema ───────────────────────────────────────────────

const JudgeResponseSchema = z.object({
  causalReasoning: z.number().min(0).max(5),
  calibration: z.number().min(0).max(5),
  riskIdentification: z.number().min(0).max(5),
  recommendationQuality: z.number().min(0).max(5),
  transparency: z.number().min(0).max(5),
})

// ── Constants ────────────────────────────────────────────────

const ZERO_SCORE: JudgeScore = {
  causalReasoning: 0,
  calibration: 0,
  riskIdentification: 0,
  recommendationQuality: 0,
  transparency: 0,
  overall: 0,
}

const JUDGE_MODEL = process.env.GEMINI_JUDGE_MODEL ?? 'gemini-3-flash-preview'

const SYSTEM_PROMPT = `You are an expert financial analysis evaluator. Score the following system output on 5 dimensions (0-5 each).

Scoring rubric:

**causalReasoning** (0-5): Does the analysis explain WHY the signal impacts the portfolio (causal mechanism), not just THAT it does?
- 0: No reasoning at all
- 1-2: States direction without mechanism ("rates up = stocks down")
- 3-4: Explains transmission channel (e.g., "higher rates increase discount rates, compressing equity valuations")
- 5: Multi-step causal chain with nuance and sector-specific effects

**calibration** (0-5): Are the dollar impact ranges tight and sensible for the portfolio size and signal magnitude?
- 0: No range or absurd range
- 1-2: Range is too wide (e.g., "$0 to $100,000" on a $60k portfolio) or implausible
- 3-4: Reasonable range proportional to portfolio and signal severity
- 5: Tight, well-justified range with clear methodology

**riskIdentification** (0-5): Does it flag key assumptions, what could go wrong, and limitations?
- 0: No risk acknowledgment
- 1-2: Generic disclaimer
- 3-4: Identifies specific assumptions or risk factors
- 5: Comprehensive risk assessment with scenarios and confidence bounds

**recommendationQuality** (0-5): Are there concrete, portfolio-aware action recommendations?
- 0: No recommendations (acceptable for single-agent baselines — score 0)
- 1-2: Generic advice ("diversify")
- 3-4: Specific actions tied to portfolio holdings
- 5: Multiple options with tradeoffs and "do nothing" baseline

**transparency** (0-5): Can the user trace how the conclusion was reached?
- 0: Black-box conclusion
- 1-2: Some reasoning but opaque derivation
- 3-4: Clear reasoning chain, cites factors considered
- 5: Full derivation showing data sources, computations, and agent contributions

Respond ONLY with valid JSON matching this schema:
{
  "causalReasoning": number,
  "calibration": number,
  "riskIdentification": number,
  "recommendationQuality": number,
  "transparency": number
}`

// ── Retry Helper ────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 5000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Error &&
        ('status' in error && ((error as { status: number }).status === 503 ||
          (error as { status: number }).status === 429))

      if (!isRetryable || attempt === maxRetries) {
        throw error
      }

      const delay = baseDelayMs * Math.pow(2, attempt) // 5s, 10s, 20s
      console.warn(
        `Judge: retryable error (attempt ${attempt + 1}/${maxRetries + 1}), ` +
        `waiting ${delay / 1000}s before retry...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Unreachable')
}

// ── Main Function ────────────────────────────────────────────

export async function judgeSystemOutput(input: JudgeInput): Promise<JudgeScore> {
  try {
    return await withRetry(async () => {
      const llm = createGeminiChatModel({
        model: JUDGE_MODEL,
        temperature: 0,
      })

      const prompt = `System under evaluation: ${input.system}

Signal: ${input.signal.headline}
Description: ${input.signal.description}

System output:
- Direction: ${input.direction}
- Dollar impact range: $${input.dollarRange.low.toLocaleString()} to $${input.dollarRange.high.toLocaleString()}
- Reasoning: ${input.reasoning}

Ground truth direction: ${input.actualDirection}

Score this output on the 5 dimensions described above.`

      const response = await llm.invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ])

      const text = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content)

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Judge: no JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      const validated = JudgeResponseSchema.parse(parsed)

      const overall = (
        validated.causalReasoning +
        validated.calibration +
        validated.riskIdentification +
        validated.recommendationQuality +
        validated.transparency
      ) / 5

      return {
        ...validated,
        overall: Math.round(overall * 100) / 100,
      }
    })
  } catch (error) {
    console.error('Judge scoring failed after retries (returning zeros):', error)
    return ZERO_SCORE
  }
}
