// Multi-Agent Analysis Pipeline — Public API
// See plans/multi-agent-pipeline/ for full architecture

import type {
  Signal,
  Portfolio,
  ExposureMap,
  FundManagerVerdict,
  ResearchBrief,
  PortfolioVerdict,
  InferredRiskProfile,
  AnalystAssessment,
  DebateResolution,
  RiskChallenge,
  MagnitudeValidation,
  StressTestResult,
  JudgeVerdict,
  UserExpectations,
  UserProfile,
} from '@prism/shared'
import { Command } from '@langchain/langgraph'
import { compilePipeline, compilePipelineNoCheckpoints } from './orchestrator.js'
import type { ThinkingCallback } from './types.js'
import { synthesizeCrossSignal } from './cross-signal-synthesizer.js'

export type MultiAgentResult = {
  readonly verdict: FundManagerVerdict
  readonly researchBrief: ResearchBrief
  readonly intermediateArtifacts: {
    readonly riskProfile: InferredRiskProfile
    readonly analystAssessments: readonly AnalystAssessment[]
    readonly debateResolution: DebateResolution
    readonly riskChallenge: RiskChallenge
    readonly magnitudeValidation: MagnitudeValidation
    readonly stressTest: StressTestResult
    readonly judgeVerdict: JudgeVerdict
  }
}

export type AnalysisProgressCallback = (stage: string, data: unknown) => void
export type { ThinkingCallback } from './types.js'

// ── Checkpoint Types ────────────────────────────────────────

export type CheckpointPause =
  | {
      readonly stage: 'debate_resolution'
      readonly type: 'hard'
      readonly debateResolution: DebateResolution
      readonly analystAssessments: readonly AnalystAssessment[]
      readonly riskProfile: InferredRiskProfile
    }
  | {
      readonly stage: 'analyst_review'
      readonly type: 'soft'
      readonly analystAssessments: readonly AnalystAssessment[]
      readonly riskProfile: InferredRiskProfile
    }
  | {
      readonly stage: 'risk_challenge_review'
      readonly type: 'soft'
      readonly riskChallenge: RiskChallenge
    }
  | {
      readonly stage: 'verdict_preview'
      readonly type: 'soft'
      readonly verdict: FundManagerVerdict
      readonly qualityScore: number
    }

export type AnalysisOutcome =
  | { readonly type: 'complete'; readonly result: MultiAgentResult; readonly threadId?: string }
  | { readonly type: 'checkpoint'; readonly checkpoint: CheckpointPause; readonly threadId: string }

/**
 * Run the full multi-agent analysis pipeline for a single signal.
 * Produces a FundManagerVerdict + ResearchBrief with calibrated dollar estimates.
 *
 * When skipCheckpoints is true, human-in-the-loop interrupts are skipped
 * and the pipeline runs end-to-end (useful for eval harness and testing).
 */
// Map LangGraph node names to user-facing progress stage names
const NODE_TO_STAGE: Readonly<Record<string, string>> = {
  infer_risk_profile: 'risk_profile',
  fetch_market_data: 'market_data',
  run_analysts: 'analyst_complete',
  soft_cp_analysts: 'soft_cp_analysts',
  run_debate: 'debate_complete',
  checkpoint_1: 'checkpoint_1',
  assumptions_challenger: 'risk_challenge',
  magnitude_validator: 'magnitude_validation',
  portfolio_stress: 'stress_complete',
  soft_cp_risk_challenge: 'soft_cp_risk_challenge',
  checkpoint_2: 'checkpoint_2',
  fund_manager: 'verdict',
  judge: 'judge',
  soft_cp_verdict: 'soft_cp_verdict',
  generate_brief: 'brief',
}

// Summarize node output into a human-readable message for the progress card
interface NodeSummary {
  readonly stage: string
  readonly message: string
  readonly analystAssessments?: unknown
  readonly debateResolution?: unknown
  readonly riskChallenge?: unknown
  readonly magnitudeValidation?: unknown
  readonly stressTest?: unknown
}

function summarizeNodeOutput(nodeName: string, nodeOutput: Record<string, unknown>): NodeSummary {
  const stage = NODE_TO_STAGE[nodeName] ?? nodeName

  switch (nodeName) {
    case 'infer_risk_profile': {
      const rp = nodeOutput.riskProfile as { tolerance?: string; horizon?: string } | null
      return { stage, message: rp ? `Risk tolerance: ${rp.tolerance}, Horizon: ${rp.horizon}` : 'Risk profile inferred' }
    }
    case 'fetch_market_data':
      return { stage, message: 'Fetched real-time volatility and correlation data' }
    case 'run_analysts': {
      const assessments = nodeOutput.analystAssessments as readonly { analystType?: string }[] | undefined
      const types = assessments?.map(a => a.analystType).join(', ') ?? 'macro, fundamental, sentiment, technical'
      return {
        stage,
        message: `${assessments?.length ?? 4} analysts completed (${types}). Independent perspectives captured across all dimensions.`,
        analystAssessments: nodeOutput.analystAssessments,
      }
    }
    case 'run_debate': {
      const debate = nodeOutput.debateResolution as { outcome?: string; rounds?: number } | null
      const rounds = debate?.rounds ?? 2
      return {
        stage,
        message: `${rounds}-round adversarial debate completed. Outcome: ${debate?.outcome ?? 'resolved'}. Key disagreements identified and resolved.`,
        debateResolution: nodeOutput.debateResolution,
      }
    }
    case 'assumptions_challenger':
      return {
        stage,
        message: 'Challenged key assumptions from analyst consensus — identified blind spots and overconfident claims.',
        riskChallenge: nodeOutput.riskChallenge,
      }
    case 'magnitude_validator':
      return {
        stage,
        message: 'Dollar-impact magnitudes validated against historical volatility and real market data.',
        magnitudeValidation: nodeOutput.magnitudeValidation,
      }
    case 'portfolio_stress':
      return {
        stage,
        message: 'Monte Carlo simulation completed (10,000 scenarios). VaR and CVaR computed at 95th and 99th percentiles.',
        stressTest: nodeOutput.stressTest,
      }
    case 'fund_manager':
      return { stage, message: 'All inputs synthesized into calibrated verdict with dollar-impact ranges bounded by computed volatility.' }
    case 'judge': {
      const jv = nodeOutput.judgeVerdict as { convergenceReached?: boolean; overallQualityScore?: number } | null
      const score = jv?.overallQualityScore ? ` (quality: ${Math.round(jv.overallQualityScore * 100)}%)` : ''
      return { stage, message: jv?.convergenceReached
        ? `Quality gate passed${score}. Verdict is well-calibrated and internally consistent.`
        : `Quality evaluation flagged issues${score}. Requesting fund manager refinement.` }
    }
    case 'generate_brief':
      return { stage, message: 'Research brief generated' }
    default:
      return { stage, message: `${nodeName} completed` }
  }
}

// ── Interrupt Detection ─────────────────────────────────────
// After streaming completes, check accumulated state to determine if we hit a checkpoint.
function detectCheckpoint(accumulated: Record<string, unknown>): CheckpointPause | null {
  const hasVerdict = accumulated.fundManagerVerdict != null
  const hasDebateResolution = accumulated.debateResolution != null
  const hasRiskChallenge = accumulated.riskChallenge != null
  const hasAnalysts = Array.isArray(accumulated.analystAssessments) && accumulated.analystAssessments.length > 0

  if (hasVerdict) return null // Pipeline completed

  // Soft checkpoint: post-verdict (has verdict from judge loop, but brief not generated yet)
  // Actually, if judge converged and we hit soft_cp_verdict, verdict exists but brief is null
  // For hard checkpoints:

  // Hard checkpoint 1: debate completed but no stress test yet
  if (hasDebateResolution && !hasRiskChallenge) {
    return {
      stage: 'debate_resolution',
      type: 'hard',
      debateResolution: accumulated.debateResolution as DebateResolution,
      analystAssessments: (accumulated.analystAssessments ?? []) as readonly AnalystAssessment[],
      riskProfile: accumulated.riskProfile as InferredRiskProfile,
    }
  }

  // Soft checkpoint: post-analysts (analysts done, no debate yet)
  if (hasAnalysts && !hasDebateResolution) {
    return {
      stage: 'analyst_review',
      type: 'soft',
      analystAssessments: (accumulated.analystAssessments ?? []) as readonly AnalystAssessment[],
      riskProfile: accumulated.riskProfile as InferredRiskProfile,
    }
  }

  // Soft checkpoint: post-risk-challenge (risk challenge done, no magnitude validation yet)
  if (hasRiskChallenge && accumulated.magnitudeValidation == null) {
    return {
      stage: 'risk_challenge_review',
      type: 'soft',
      riskChallenge: accumulated.riskChallenge as RiskChallenge,
    }
  }

  return null
}

function buildResult(accumulated: Record<string, unknown>): MultiAgentResult {
  return {
    verdict: accumulated.fundManagerVerdict as FundManagerVerdict,
    researchBrief: accumulated.researchBrief as ResearchBrief,
    intermediateArtifacts: {
      riskProfile: accumulated.riskProfile as InferredRiskProfile,
      analystAssessments: (accumulated.analystAssessments ?? []) as readonly AnalystAssessment[],
      debateResolution: accumulated.debateResolution as DebateResolution,
      riskChallenge: accumulated.riskChallenge as RiskChallenge,
      magnitudeValidation: accumulated.magnitudeValidation as MagnitudeValidation,
      stressTest: accumulated.stressTest as StressTestResult,
      judgeVerdict: accumulated.judgeVerdict as JudgeVerdict,
    },
  }
}

// Stream the pipeline and report progress, returning accumulated state
async function streamPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compiled: ReturnType<typeof compilePipeline>,
  input: any, // LangGraph accepts state objects or Command instances
  config: Record<string, unknown>,
  onProgress?: AnalysisProgressCallback,
): Promise<Record<string, unknown>> {
  const accumulated: Record<string, unknown> = {}
  const stream = await compiled.stream(input, { ...config, streamMode: 'updates' as const })

  for await (const chunk of stream) {
    for (const [nodeName, nodeOutput] of Object.entries(chunk as Record<string, Record<string, unknown>>)) {
      Object.assign(accumulated, nodeOutput)
      const stageName = NODE_TO_STAGE[nodeName]
      if (stageName && onProgress) {
        const summary = summarizeNodeOutput(nodeName, nodeOutput)
        onProgress(stageName, summary)
      }
    }
  }

  return accumulated
}

export async function runMultiAgentAnalysis(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userProfile: UserProfile
  readonly userExpectations?: UserExpectations
  readonly skipCheckpoints?: boolean
  readonly onProgress?: AnalysisProgressCallback
  readonly onThinking?: ThinkingCallback
}): Promise<MultiAgentResult>

export async function runMultiAgentAnalysis(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userProfile: UserProfile
  readonly userExpectations?: UserExpectations
  readonly skipCheckpoints?: boolean
  readonly pipelineMode?: 'quick' | 'guided'
  readonly onProgress?: AnalysisProgressCallback
  readonly onThinking?: ThinkingCallback
}): Promise<AnalysisOutcome>

export async function runMultiAgentAnalysis(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userProfile: UserProfile
  readonly userExpectations?: UserExpectations
  readonly skipCheckpoints?: boolean
  readonly pipelineMode?: 'quick' | 'guided'
  readonly onProgress?: AnalysisProgressCallback
  readonly onThinking?: ThinkingCallback
}): Promise<MultiAgentResult | AnalysisOutcome> {
  const {
    signal,
    portfolio,
    exposureMap,
    userProfile,
    userExpectations,
    skipCheckpoints = false,
    pipelineMode,
    onProgress,
    onThinking,
  } = params

  const isGuided = pipelineMode === 'guided'
  const shouldSkip = skipCheckpoints || pipelineMode === 'quick'

  const compiled = shouldSkip
    ? compilePipelineNoCheckpoints(onThinking)
    : compilePipeline(onThinking)

  const threadId = `analysis-${signal.id}-${Date.now()}`
  const config = shouldSkip
    ? {}
    : { configurable: { thread_id: threadId } }

  const initialState = {
    signal,
    portfolio,
    exposureMap,
    userProfile,
    userExpectations: userExpectations ?? undefined,
    skipCheckpoints: shouldSkip,
    pipelineMode: (isGuided ? 'guided' : 'quick') as 'guided' | 'quick',
    riskProfile: null,
    marketData: null,
    debateResolution: null,
    humanCorrectionAtDebate: null,
    humanCorrectionPreDebate: null,
    humanRiskChallengeOverrides: null,
    humanScenarioPreference: null,
    riskChallenge: null,
    magnitudeValidation: null,
    stressTest: null,
    fundManagerVerdict: null,
    judgeVerdict: null,
    synthesisRound: 0,
    judgeFeedback: null,
    researchBrief: null,
  }

  // Streaming mode with progress updates
  if (onProgress) {
    const accumulated = await streamPipeline(compiled, initialState, config, onProgress)

    // In guided mode, check if we hit a checkpoint (interrupt)
    if (isGuided) {
      const checkpoint = detectCheckpoint(accumulated)
      if (checkpoint) {
        return { type: 'checkpoint', checkpoint, threadId } as AnalysisOutcome
      }
      return { type: 'complete', result: buildResult(accumulated), threadId } as AnalysisOutcome
    }

    return buildResult(accumulated)
  }

  // Fallback: use .invoke() when no progress callback (eval harness, testing)
  const result = await compiled.invoke(initialState, config)

  return {
    verdict: result.fundManagerVerdict!,
    researchBrief: result.researchBrief!,
    intermediateArtifacts: {
      riskProfile: result.riskProfile!,
      analystAssessments: result.analystAssessments,
      debateResolution: result.debateResolution!,
      riskChallenge: result.riskChallenge!,
      magnitudeValidation: result.magnitudeValidation!,
      stressTest: result.stressTest!,
      judgeVerdict: result.judgeVerdict!,
    },
  }
}

/**
 * Resume a paused pipeline from a checkpoint with human input.
 * Uses Command({ resume }) to inject the human's response into the interrupted node.
 */
export async function resumeAnalysis(params: {
  readonly threadId: string
  readonly humanInput: string
  readonly onProgress?: AnalysisProgressCallback
  readonly onThinking?: ThinkingCallback
}): Promise<AnalysisOutcome> {
  const { threadId, humanInput, onProgress, onThinking } = params

  const compiled = compilePipeline(onThinking)
  const config = { configurable: { thread_id: threadId } }
  const resumeCommand = new Command({ resume: humanInput })

  const accumulated = await streamPipeline(compiled, resumeCommand, config, onProgress)

  const checkpoint = detectCheckpoint(accumulated)
  if (checkpoint) {
    return { type: 'checkpoint', checkpoint, threadId }
  }

  return { type: 'complete', result: buildResult(accumulated), threadId }
}

/**
 * Run portfolio review mode: analyze multiple signals in parallel,
 * then synthesize cross-signal interactions into a unified PortfolioVerdict.
 */
export async function runPortfolioReview(params: {
  readonly signals: readonly Signal[]
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userProfile: UserProfile
  readonly userExpectations?: UserExpectations
  readonly onProgress?: AnalysisProgressCallback
}): Promise<PortfolioVerdict> {
  const { signals, portfolio, exposureMap, userProfile, userExpectations, onProgress } = params

  // Run per-signal pipelines in parallel
  const results = await Promise.all(
    signals.map(async (signal) => {
      onProgress?.('pipeline_start', { signalId: signal.id })
      const result = await runMultiAgentAnalysis({
        signal,
        portfolio,
        exposureMap,
        userProfile,
        userExpectations,
        skipCheckpoints: true, // Portfolio review runs uninterrupted
      })
      onProgress?.('pipeline_complete', { signalId: signal.id })
      return { signal, result }
    }),
  )

  // Synthesize cross-signal interactions
  const signalVerdicts = results.map(({ signal, result }) => ({
    signal,
    verdict: result.verdict,
  }))

  onProgress?.('cross_signal_synthesis', { signalCount: signals.length })
  return synthesizeCrossSignal({ signalVerdicts })
}

// Re-export key modules for direct access
export { buildPipelineGraph, compilePipeline, compilePipelineNoCheckpoints } from './orchestrator.js'
export { PipelineState } from './state.js'
export { generateResearchBrief } from './research-brief.js'
export { synthesizeCrossSignal, aggregateHoldingImpacts, classifyInteraction } from './cross-signal-synthesizer.js'
