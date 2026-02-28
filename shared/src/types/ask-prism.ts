import type {
  UserProfile,
  Holding,
  ExposureMap,
  Signal,
  CausalChain,
  CausalChainNode,
  StrategyCandidate,
  StrategyEvaluation,
} from '../index'

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

export type AskPrismPage = 'portfolio' | 'signals_overview' | 'signal' | 'plan'

export type AskPrismSessionScope =
  | 'global'
  | `signal:${string}`
  | `plan:${string}`
  | `node:${string}:${string}`

export type AskPrismEntryType =
  | 'fab'
  | 'signal_card'
  | 'signals_canvas'
  | 'graph_node'
  | 'sidebar_cta'

export interface AskPrismEntryContext {
  readonly entryType: AskPrismEntryType
  readonly signalId?: string
  readonly nodeId?: string
  readonly nodeLabel?: string
  readonly autoPrompt?: string
}

export interface AskPrismNetImpactSummary {
  readonly signalUniverseCount: number
  readonly includedSignalCount: number
  readonly oneWeekImpactCad: number
  readonly oneMonthImpactCad: number
  readonly sixMonthImpactCad: number
  readonly topContributors: ReadonlyArray<{
    readonly signalId: string
    readonly headline: string
    readonly normalizedWeight: number
    readonly oneMonthImpactCad: number
  }>
}

export interface AskPrismContextSnapshotMeta {
  readonly generatedAt: string
  readonly activeSignalCount: number
  readonly focusedSignalDetectedAt?: string
  readonly signalSourceSummary: ReadonlyArray<{
    readonly signalId: string
    readonly sourceCount: number
  }>
}

/**
 * Unified context for Ask Prism chat with three progressive layers:
 * - Layer 1: Always present (Portfolio page)
 * - Layer 2: Signal Detail page
 * - Layer 3: Plan page
 */
export interface AskPrismContext {
  readonly page: AskPrismPage
  readonly sessionScope: AskPrismSessionScope
  readonly entryContext?: AskPrismEntryContext

  // Layer 1 — always present (Portfolio page)
  readonly profile: UserProfile
  readonly holdings: ReadonlyArray<Holding>
  readonly exposureMap: ExposureMap
  readonly activeSignals: ReadonlyArray<Signal>
  readonly contextSnapshotMeta: AskPrismContextSnapshotMeta
  readonly portfolioNetImpact?: AskPrismNetImpactSummary

  // Layer 2 — Signal Detail page
  readonly focusedSignal?: Signal
  readonly focusedNode?: CausalChainNode
  readonly causalChain?: CausalChain
  readonly temporalAnalysis?: AskPrismTemporalAnalysis

  // Layer 3 — Plan page
  readonly strategyCandidates?: ReadonlyArray<StrategyCandidate>
  readonly currentPlan?: ReadonlyArray<PlanSelection>
  readonly evaluation?: StrategyEvaluation
}

export type AskPrismPlanAction =
  | {
      readonly type: 'add_candidate'
      readonly candidateId: string
      readonly ticker: string
      readonly allocationPct: number
    }
  | {
      readonly type: 'remove_candidate'
      readonly candidateId: string
      readonly ticker: string
    }
  | {
      readonly type: 'set_allocation'
      readonly candidateId: string
      readonly ticker: string
      readonly allocationPct: number
    }

export interface AskPrismPlanProposal {
  readonly actions: ReadonlyArray<AskPrismPlanAction>
  readonly rationale: string
  readonly expectedEffects: ReadonlyArray<string>
  readonly warnings: ReadonlyArray<string>
}

export interface AskPrismCopilotProposalResponse {
  readonly assistantText: string
  readonly proposal: AskPrismPlanProposal | null
  readonly followUps: ReadonlyArray<string>
}
