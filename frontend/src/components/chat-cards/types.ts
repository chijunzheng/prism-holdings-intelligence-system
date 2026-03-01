import type {
  AnalystAssessment,
  DebateResolution,
  FundManagerVerdict,
  InferredRiskProfile,
  MagnitudeValidation,
  PlanPreview,
  Recommendation,
  RecommendationAction,
  ResearchBrief,
  RiskChallenge,
  Signal,
  StressTestResult,
  StructuredResponseData,
} from '@prism/shared'

// ── Action Center Mode ────────────────────────────────────

export type ActionCenterMode =
  | { readonly mode: 'idle' }
  | { readonly mode: 'holding_detail'; readonly ticker: string; readonly holdingData: SignalImpactDeltaData['affectedHoldings'][number] }
  | { readonly mode: 'debate_transcript'; readonly debate: DebateResolution }
  | { readonly mode: 'comparison'; readonly recommendations: readonly Recommendation[] }
  | { readonly mode: 'reasoning_trace'; readonly trace: ReasoningTraceData }
  | { readonly mode: 'research_brief'; readonly brief: ResearchBrief }

export type StageStatus = 'pending' | 'active' | 'complete' | 'waiting'

export interface PipelineStageInfo {
  readonly id: string
  readonly label: string
  readonly status: StageStatus
  readonly message?: string
  readonly thinkingText?: string
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
  readonly actions?: readonly RecommendationAction[]
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

export interface TransparencyBarData {
  readonly agentCount: number
  readonly debateRounds: number
  readonly qualityScore: number
  readonly reasoningTrace: ReasoningTraceData
}

export interface VerdictSummaryData {
  readonly netImpact: number
  readonly holdingCount: number
  readonly direction: 'bearish' | 'bullish' | 'neutral'
  readonly confidence: number
  readonly signalHeadline: string
}

export interface AnalysisCompleteData {
  readonly verdict?: FundManagerVerdict
  readonly researchBrief?: ResearchBrief
  readonly impactDelta?: SignalImpactDeltaData
  readonly playbook?: ActionPlaybookData
  readonly intermediateArtifacts?: {
    readonly riskProfile: InferredRiskProfile
    readonly analystAssessments: readonly AnalystAssessment[]
    readonly debateResolution: DebateResolution
    readonly riskChallenge: RiskChallenge
    readonly magnitudeValidation: MagnitudeValidation
    readonly stressTest: StressTestResult
  }
}

export interface CheckpointCardData {
  readonly stage: string
  readonly prompt: string
  readonly quickReplies?: readonly string[]
}

export interface SoftCheckpointData {
  readonly stage: string
  readonly type: 'soft'
  readonly prompt: string
  readonly [key: string]: unknown
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
  | { readonly type: 'plan_preview'; readonly data: PlanPreview }
  | { readonly type: 'structured_response'; readonly data: StructuredResponseData }
  | { readonly type: 'transparency_bar'; readonly data: TransparencyBarData }
  | { readonly type: 'verdict_summary'; readonly data: VerdictSummaryData }
  | { readonly type: 'soft_checkpoint'; readonly data: SoftCheckpointData }
