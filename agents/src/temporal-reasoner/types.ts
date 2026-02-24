import type { TemporalClassification, UserProfile } from '@prism/shared'

export type ImpactDirection = 'positive' | 'negative' | 'ambiguous'

export interface ClassificationMethodology {
  readonly historicalBaseRate: string
  readonly signalClustering: string
  readonly structuralIndicators: string
  readonly contextualSynthesis: string
}

export interface ImpactEstimate {
  readonly direction: ImpactDirection
  readonly expectedDollarImpact: number
  readonly lowDollarImpact: number
  readonly highDollarImpact: number
  readonly confidence: number
}

export interface Recommendation {
  readonly id: string
  readonly horizon: 'one_week' | 'one_month' | 'six_month'
  readonly summary: string
  readonly rationale: string
  readonly tradeoffs: string
  readonly proposedShiftCad: number
}

export interface TensionAnalysis {
  readonly shortTermView: string
  readonly longTermView: string
  readonly explanation: string
  readonly whatEachAssumes: string
}

export interface CounterfactualAnalysis {
  readonly scenario: string
  readonly estimatedOutcomeDifferenceCad: number
  readonly explanation: string
}

export interface ImpactClassification {
  readonly nodeId: string
  readonly assetLabel: string
  readonly ticker?: string
  readonly dollarImpact: number
  readonly classification: TemporalClassification
  readonly confidence: number
  readonly reasoning: string
}

export interface TemporalAnalysis {
  readonly classification: TemporalClassification
  readonly confidence: number
  readonly methodology: ClassificationMethodology
  readonly impactClassifications: ReadonlyArray<ImpactClassification>
  readonly timeBuckets: {
    readonly oneWeek: ImpactEstimate
    readonly oneMonth: ImpactEstimate
    readonly sixMonth: ImpactEstimate
  }
  readonly recommendations: ReadonlyArray<Recommendation>
  readonly tension?: TensionAnalysis
  readonly counterfactual?: CounterfactualAnalysis
}

export interface TemporalReasoningContext {
  readonly classification: TemporalClassification
  readonly confidence: number
  readonly methodology: ClassificationMethodology
  readonly impactClassifications: ReadonlyArray<ImpactClassification>
  readonly netDollarImpact: number
  readonly directionBias: number
  readonly hasCompetingEffects: boolean
}

export interface RecommendationInputs {
  readonly profile: UserProfile
  readonly context: TemporalReasoningContext
  readonly oneWeekDirection: ImpactDirection
  readonly sixMonthDirection: ImpactDirection
}
