import type { CausalChain, Signal, TemporalClassification } from '@prism/shared'

export type GraphTimeHorizon = 'oneWeek' | 'oneMonth' | 'sixMonth'

export interface TemporalImpactEstimate {
  readonly direction: 'positive' | 'negative' | 'ambiguous'
  readonly expectedDollarImpact: number
  readonly lowDollarImpact: number
  readonly highDollarImpact: number
  readonly confidence: number
}

export interface TemporalAnalysis {
  readonly classification: TemporalClassification
  readonly confidence: number
  readonly timeBuckets: {
    readonly oneWeek: TemporalImpactEstimate
    readonly oneMonth: TemporalImpactEstimate
    readonly sixMonth: TemporalImpactEstimate
  }
  readonly recommendations: ReadonlyArray<{
    readonly id: string
    readonly horizon: 'one_week' | 'one_month' | 'six_month'
    readonly summary: string
    readonly rationale: string
    readonly tradeoffs: string
    readonly proposedShiftCad: number
  }>
  readonly counterfactual?: {
    readonly scenario: string
    readonly estimatedOutcomeDifferenceCad: number
    readonly explanation: string
  }
}

export interface GraphDataResponse {
  readonly signal: Signal
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
}

export interface GraphNodePosition {
  readonly x: number
  readonly y: number
}
