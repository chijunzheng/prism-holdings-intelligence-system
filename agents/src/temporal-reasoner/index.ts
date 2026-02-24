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

/**
 * Temporal Reasoner (Feature 08)
 * Produces multi-horizon temporal analysis from a validated causal chain
 * and user profile context.
 */
export async function classify(
  chain: CausalChain,
  profile: UserProfile,
): Promise<AgentResult<TemporalAnalysis>> {
  const start = performance.now()

  try {
    const context = classifyTemporalDynamics(chain)
    const timeBuckets = estimateTimeBuckets(context)
    const recommendations = buildRecommendations({
      profile,
      context,
      oneWeekDirection: timeBuckets.oneWeek.direction,
      sixMonthDirection: timeBuckets.sixMonth.direction,
    })
    const tension = detectRecommendationTension(recommendations, {
      profile,
      context,
      oneWeekDirection: timeBuckets.oneWeek.direction,
      sixMonthDirection: timeBuckets.sixMonth.direction,
    })

    const analysis: TemporalAnalysis = {
      classification: context.classification,
      confidence: context.confidence,
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
