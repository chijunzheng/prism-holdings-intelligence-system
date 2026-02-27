import type { UserProfile, Holding, ExposureMap, Signal, CausalChain, StrategyCandidate, StrategyEvaluation } from '../index'

/**
 * Lightweight temporal analysis for Ask Prism context.
 * Matches the agent's TemporalAnalysis structure but with simplified types.
 */
export interface AskPrismTemporalAnalysis {
  readonly classification: string
  readonly confidence: number
  readonly timeBuckets: {
    readonly oneWeek: { readonly expectedDollarImpact: number }
    readonly oneMonth: { readonly expectedDollarImpact: number }
    readonly sixMonth: { readonly expectedDollarImpact: number }
  }
  readonly counterfactual?: {
    readonly scenario: string
    readonly estimatedOutcomeDifferenceCad: number
    readonly explanation: string
  }
}

/**
 * User's selection of a strategy candidate with allocation.
 */
export interface PlanSelection {
  readonly candidateId: string
  readonly ticker: string
  readonly name: string
  readonly allocationPct: number
}

/**
 * Unified context for Ask Prism chat with three progressive layers:
 * - Layer 1: Always present (Portfolio page)
 * - Layer 2: Signal Detail page
 * - Layer 3: Plan page
 */
export interface AskPrismContext {
  // Layer 1 — always present (Portfolio page)
  readonly profile: UserProfile
  readonly holdings: ReadonlyArray<Holding>
  readonly exposureMap: ExposureMap
  readonly activeSignals: ReadonlyArray<Signal>

  // Layer 2 — Signal Detail page
  readonly focusedSignal?: Signal
  readonly causalChain?: CausalChain
  readonly temporalAnalysis?: AskPrismTemporalAnalysis

  // Layer 3 — Plan page
  readonly strategyCandidates?: ReadonlyArray<StrategyCandidate>
  readonly currentPlan?: ReadonlyArray<PlanSelection>
  readonly evaluation?: StrategyEvaluation
}

/**
 * Page identifier for context layering.
 */
export type AskPrismPage = 'portfolio' | 'signal' | 'plan'
