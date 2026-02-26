import type { CausalChain, UserProfile } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { classifyTemporalDynamics } from './classify'
import { estimateTimeBuckets } from './time-buckets'
import { buildRecommendations, detectRecommendationTension } from './recommendations'
import { buildCounterfactual } from './counterfactual'
import type { TemporalAnalysis } from './types'

export const config: AgentConfig = {
  name: 'temporal-reasoner',
  description: 'Classifies impact as transient/structural/ambiguous',
  usesLlm: true,
}

export type { TemporalAnalysis } from './types'

export interface TemporalReasoningRuntimeContext {
  readonly totalPortfolioValueCad?: number
  readonly holdingWeightsByTicker?: Readonly<Record<string, number>>
}

/**
 * Temporal Reasoner (Feature 08)
 * Produces multi-horizon temporal analysis from a validated causal chain
 * and user profile context.
 */
export async function classify(
  chain: CausalChain,
  profile: UserProfile,
  runtime?: number | TemporalReasoningRuntimeContext,
): Promise<AgentResult<TemporalAnalysis>> {
  const start = performance.now()

  try {
    const runtimeContext: TemporalReasoningRuntimeContext =
      typeof runtime === 'number' ? { totalPortfolioValueCad: runtime } : (runtime ?? {})
    const context = classifyTemporalDynamics(chain)
    const timeBuckets = estimateTimeBuckets(context)
    const inferredPortfolioValue =
      context.impactClassifications.reduce(
        (sum, impact) => sum + Math.abs(impact.dollarImpact),
        0,
      ) * 8
    const resolvedPortfolioValueCad = Math.max(
      10_000,
      Math.round(runtimeContext.totalPortfolioValueCad ?? inferredPortfolioValue),
    )
    const recommendations = buildRecommendations({
      profile,
      context,
      totalPortfolioValueCad: resolvedPortfolioValueCad,
      holdingWeightsByTicker: runtimeContext.holdingWeightsByTicker,
      oneWeekDirection: timeBuckets.oneWeek.direction,
      sixMonthDirection: timeBuckets.sixMonth.direction,
      oneWeekExpectedImpactCad: timeBuckets.oneWeek.expectedDollarImpact,
      sixMonthExpectedImpactCad: timeBuckets.sixMonth.expectedDollarImpact,
    })
    const tension = detectRecommendationTension(recommendations, {
      profile,
      context,
      totalPortfolioValueCad: resolvedPortfolioValueCad,
      holdingWeightsByTicker: runtimeContext.holdingWeightsByTicker,
      oneWeekDirection: timeBuckets.oneWeek.direction,
      sixMonthDirection: timeBuckets.sixMonth.direction,
      oneWeekExpectedImpactCad: timeBuckets.oneWeek.expectedDollarImpact,
      sixMonthExpectedImpactCad: timeBuckets.sixMonth.expectedDollarImpact,
    })

    const analysis: TemporalAnalysis = {
      classification: context.classification,
      confidence: context.confidence,
      totalPortfolioValueCad: resolvedPortfolioValueCad,
      methodology: context.methodology,
      impactClassifications: context.impactClassifications,
      timeBuckets,
      recommendations,
      tension,
      counterfactual: buildCounterfactual(
        recommendations,
        timeBuckets.sixMonth.expectedDollarImpact,
      ),
    }

    return {
      success: true,
      data: analysis,
      durationMs: performance.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown temporal reasoning error',
      durationMs: performance.now() - start,
    }
  }
}
