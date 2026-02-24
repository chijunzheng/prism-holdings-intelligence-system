import type { CausalChain, UserProfile } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { classify as classifyTemporalReasoning } from '../temporal-reasoner'
import type { TemporalAnalysis } from '../temporal-reasoner'
import { createPersonalizationEngine, type ToneLevel } from '../personalization'
import { evaluateAlertDispatch } from './frequency'
import {
  deriveUrgency,
  evaluateMateriality,
  type AlertMateriality,
  type AlertSuppressionReason,
} from './thresholds'
import { formatAlertPayload, passesAdvisorCallTest } from './format'

export interface AlertOutput {
  readonly headline: string
  readonly body: string
  readonly urgency: 'low' | 'medium' | 'high' | 'critical'
  readonly tone: ToneLevel
  readonly materiality: AlertMateriality
  readonly impactPct: number
  readonly shouldNotify: boolean
  readonly suppressedReason?: AlertSuppressionReason
  readonly passesAdvisorCallTest: boolean
  readonly signalCard: {
    readonly headline: string
    readonly classificationBadge: 'transient' | 'structural' | 'ambiguous'
    readonly materialityIndicator: string
  }
}

interface ComposeOptions {
  readonly totalPortfolioValueCad?: number
  readonly temporalAnalysis?: TemporalAnalysis
  readonly now?: Date
}

export const config: AgentConfig = {
  name: 'alert-composer',
  description: 'Personalized alert generation with frequency caps',
  usesLlm: true,
}

export async function compose(
  chain: CausalChain,
  profile: UserProfile,
  options?: ComposeOptions,
): Promise<AgentResult<AlertOutput>> {
  const start = performance.now()
  const personalizationEngine = createPersonalizationEngine()

  try {
    const temporalResult =
      options?.temporalAnalysis !== undefined
        ? { success: true as const, data: options.temporalAnalysis }
        : await classifyTemporalReasoning(chain, profile)

    if (!temporalResult.success || !temporalResult.data) {
      return {
        success: false,
        error: temporalResult.error ?? 'Failed to compute temporal analysis',
        durationMs: performance.now() - start,
      }
    }

    const analysis = temporalResult.data
    const totalPortfolioValueCad = options?.totalPortfolioValueCad ?? 40_000
    const threshold = personalizationEngine.getMaterialityThreshold(profile)
    const materiality = evaluateMateriality(analysis, threshold, totalPortfolioValueCad)
    const tone = personalizationEngine.getToneLevel(profile)
    const urgency = deriveUrgency(
      analysis.classification,
      materiality.materiality,
      analysis.confidence,
      personalizationEngine.getUrgencyMultiplier(profile, analysis.classification),
    )
    const formatted = formatAlertPayload({
      analysis,
      profile,
      tone,
      materiality: materiality.materiality,
    })
    const advisorCallPasses = passesAdvisorCallTest(
      materiality.materiality,
      analysis.confidence,
    )

    let shouldNotify = true
    let suppressedReason: AlertSuppressionReason | undefined

    if (!materiality.shouldSurface) {
      shouldNotify = false
      suppressedReason = 'below_materiality'
    } else {
      const frequencyDecision = evaluateAlertDispatch({
        userId: profile.id,
        chainId: chain.id,
        magnitudeCad: Math.abs(analysis.timeBuckets.oneMonth.expectedDollarImpact),
        effectiveDailyCap: personalizationEngine.getEffectiveDailyAlertCap(profile),
        now: options?.now,
      })
      if (!frequencyDecision.allowed) {
        shouldNotify = false
        suppressedReason = frequencyDecision.reason
      }
    }

    return {
      success: true,
      data: {
        headline: formatted.headline,
        body: formatted.body,
        urgency,
        tone,
        materiality: materiality.materiality,
        impactPct: materiality.impactPct,
        shouldNotify,
        suppressedReason,
        passesAdvisorCallTest: advisorCallPasses,
        signalCard: formatted.signalCard,
      },
      durationMs: performance.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown alert composition error',
      durationMs: performance.now() - start,
    }
  }
}
