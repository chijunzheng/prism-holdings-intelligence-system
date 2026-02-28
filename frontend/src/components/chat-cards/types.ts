import type {
  AnalystAssessment,
  DebateResolution,
  FundManagerVerdict,
  InferredRiskProfile,
  MagnitudeValidation,
  Recommendation,
  ResearchBrief,
  RiskChallenge,
  Signal,
  StressTestResult,
} from '@prism/shared'

export type StageStatus = 'pending' | 'active' | 'complete'

export interface PipelineStageInfo {
  readonly id: string
  readonly label: string
  readonly status: StageStatus
  readonly message?: string
}

export interface PipelineProgressData {
  readonly stages: readonly PipelineStageInfo[]
  readonly error?: string
}

export interface SignalImpactDeltaData {
  readonly signalId: string
  readonly signalHeadline: string
  readonly summary: string
  readonly netImpactMidCad: number
  readonly affectedHoldings: readonly {
    readonly ticker: string
    readonly name: string
    readonly impactMidCad: number
    readonly confidence: number
  }[]
}

export interface ActionPlaybookData {
  readonly signalId: string
  readonly recommendationId: string
  readonly title: string
  readonly rationale: string
  readonly estimatedCost: string
  readonly riskReduction: string
  readonly tradeoffs: readonly string[]
  readonly steps: readonly {
    readonly id: string
    readonly title: string
    readonly detail: string
  }[]
  readonly alternatives: readonly Recommendation[]
}

export interface ReasoningTraceStep {
  readonly stageId: string
  readonly stageLabel: string
  readonly summary: string
  readonly detail?: string
}

export interface ReasoningTraceData {
  readonly signalId: string
  readonly signalHeadline: string
  readonly summary: string
  readonly riskProfile?: InferredRiskProfile
  readonly analystAssessments?: readonly AnalystAssessment[]
  readonly debateResolution?: DebateResolution
  readonly riskChallenge?: RiskChallenge
  readonly magnitudeValidation?: MagnitudeValidation
  readonly stressTest?: StressTestResult
  readonly steps: readonly ReasoningTraceStep[]
}

export interface TraceNavigatorData {
  readonly signalId: string
  readonly signalHeadline: string
  readonly completedSteps: number
  readonly totalSteps: number
  readonly steps: readonly ReasoningTraceStep[]
}

export interface AnalysisCompleteData {
  readonly verdict?: FundManagerVerdict
  readonly researchBrief?: ResearchBrief
  readonly intermediateArtifacts?: {
    readonly riskProfile: InferredRiskProfile
    readonly analystAssessments: readonly AnalystAssessment[]
    readonly debateResolution: DebateResolution
    readonly riskChallenge: RiskChallenge
    readonly magnitudeValidation: MagnitudeValidation
    readonly stressTest: StressTestResult
  }
}

export type ChatCard =
  | { readonly type: 'signal'; readonly data: Signal }
  | { readonly type: 'thinking'; readonly data: unknown }
  | { readonly type: 'pipeline_progress'; readonly data: PipelineProgressData }
  | { readonly type: 'debate_summary'; readonly data: unknown }
  | { readonly type: 'checkpoint'; readonly data: unknown }
  | { readonly type: 'stress_scenario'; readonly data: unknown }
  | { readonly type: 'recommendation'; readonly data: readonly Recommendation[] }
  | { readonly type: 'transparency'; readonly data: unknown }
  | { readonly type: 'portfolio_review'; readonly data: unknown }
  | { readonly type: 'research_brief'; readonly data: ResearchBrief }
  | { readonly type: 'signal_impact_delta'; readonly data: SignalImpactDeltaData }
  | { readonly type: 'action_playbook'; readonly data: ActionPlaybookData }
  | { readonly type: 'trace_navigator'; readonly data: TraceNavigatorData }
  | { readonly type: 'reasoning_trace'; readonly data: ReasoningTraceData }
