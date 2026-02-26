import type { CausalChain, CausalChainNode, ExposureMap, Signal, UserProfile } from '@prism/shared'

export interface TemporalImpactEstimate {
  readonly direction: 'positive' | 'negative' | 'ambiguous'
  readonly expectedDollarImpact: number
  readonly lowDollarImpact: number
  readonly highDollarImpact: number
  readonly confidence: number
}

export interface TemporalAnalysis {
  readonly classification: string
  readonly confidence: number
  readonly totalPortfolioValueCad?: number
  readonly timeBuckets: {
    readonly oneWeek: TemporalImpactEstimate
    readonly oneMonth: TemporalImpactEstimate
    readonly sixMonth: TemporalImpactEstimate
  }
  readonly recommendations: ReadonlyArray<{
    readonly id: string
    readonly horizon: string
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

export interface ChatContext {
  readonly node: CausalChainNode
  readonly chain: CausalChain
  readonly signal: Signal
  readonly exposureMap: ExposureMap
  readonly profile: UserProfile
  readonly temporalAnalysis: TemporalAnalysis
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface WhatIfDetection {
  readonly isWhatIf: boolean
  readonly modifiedAssumption: string | null
}
