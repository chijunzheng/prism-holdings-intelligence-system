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
  | { readonly mode: 'analyst_picker'; readonly assessments: readonly AnalystAssessment[] }
  | { readonly mode: 'analyst_detail'; readonly assessment: AnalystAssessment }
  | { readonly mode: 'assumption_challenges'; readonly riskChallenge: RiskChallenge }
  | { readonly mode: 'magnitude_detail'; readonly magnitudeValidation: MagnitudeValidation }
  | { readonly mode: 'stress_detail'; readonly stressTest: StressTestResult }

export type StageStatus = 'pending' | 'active' | 'complete' | 'waiting'

export interface PipelineStageInfo {
  readonly id: string
  readonly label: string
  readonly status: StageStatus
  readonly message?: string
  readonly thinkingText?: string
  readonly thinkingHistory?: readonly string[]
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
  readonly summary?: {
    readonly direction: string
    readonly confidence: number
    readonly unresolvedCount: number
  }
}

export interface SoftCheckpointData {
  readonly stage: string
  readonly type: 'soft'
  readonly prompt: string
  readonly analystAssessments?: readonly AnalystAssessment[]
  readonly riskProfile?: InferredRiskProfile
  readonly riskChallenge?: RiskChallenge
  readonly [key: string]: unknown
}

// ── Agent Progress (inline pipeline stream) ──────────────

export interface AgentStageState {
  readonly id: string
  readonly label: string
  readonly status: 'pending' | 'active' | 'complete'
  readonly thinkingText?: string
  readonly thinkingHistory?: readonly string[]
  readonly completionMessage?: string
  readonly expandable: boolean
}

export interface AgentProgressGroupData {
  readonly signalHeadline: string
  readonly stages: readonly AgentStageState[]
  readonly isComplete: boolean
  readonly error?: string
  readonly intermediateArtifacts?: {
    readonly analystAssessments?: readonly AnalystAssessment[]
    readonly riskChallenge?: RiskChallenge
    readonly debateResolution?: DebateResolution
    readonly magnitudeValidation?: MagnitudeValidation
    readonly stressTest?: StressTestResult
  }
}

// ── Analysis Report (consolidated final card) ────────────

export interface AnalysisReportData {
  readonly signal: { readonly id: string; readonly headline: string }
  readonly verdict: FundManagerVerdict
  readonly impactDelta: SignalImpactDeltaData
  readonly intermediateArtifacts?: {
    readonly riskProfile: InferredRiskProfile
    readonly analystAssessments: readonly AnalystAssessment[]
    readonly debateResolution: DebateResolution
    readonly riskChallenge: RiskChallenge
    readonly magnitudeValidation: MagnitudeValidation
    readonly stressTest: StressTestResult
  }
  readonly researchBrief?: ResearchBrief
  readonly qualityScore: number
  readonly agentCount: number
  readonly debateRounds: number
}

// ── Signal Update (watched signal change) ─────────────────

export interface SignalUpdateData {
  readonly signalId: string
  readonly headline: string
  readonly watchedSince: string
  readonly changes: readonly string[]
  readonly originalSentiment: string
  readonly newSentiment: string
}

export type ChatCard =
  | { readonly type: 'signal'; readonly data: Signal }
  | { readonly type: 'thinking'; readonly data: unknown }
  | { readonly type: 'pipeline_progress'; readonly data: PipelineProgressData }
  | { readonly type: 'debate_summary'; readonly data: unknown }
  | { readonly type: 'checkpoint'; readonly data: unknown }
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
  | { readonly type: 'agent_progress_group'; readonly data: AgentProgressGroupData }
  | { readonly type: 'analysis_report'; readonly data: AnalysisReportData }
  | { readonly type: 'signal_update'; readonly data: SignalUpdateData }
