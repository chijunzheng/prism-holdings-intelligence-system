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
import { compilePipeline, compilePipelineNoCheckpoints } from './orchestrator.js'
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
  run_debate: 'debate_complete',
  checkpoint_1: 'checkpoint_1',
  assumptions_challenger: 'risk_challenge',
  magnitude_validator: 'magnitude_validation',
  portfolio_stress: 'stress_complete',
  checkpoint_2: 'checkpoint_2',
  fund_manager: 'verdict',
  judge: 'judge',
  generate_brief: 'brief',
}

// Summarize node output into a human-readable message for the progress card
function summarizeNodeOutput(nodeName: string, nodeOutput: Record<string, unknown>): { stage: string; message: string } {
  const stage = NODE_TO_STAGE[nodeName] ?? nodeName

  switch (nodeName) {
    case 'infer_risk_profile': {
      const rp = nodeOutput.riskProfile as { tolerance?: string; horizon?: string } | null
      return { stage, message: rp ? `Risk tolerance: ${rp.tolerance}, Horizon: ${rp.horizon}` : 'Risk profile inferred' }
    }
    case 'fetch_market_data':
      return { stage, message: 'Fetched real-time volatility and correlation data' }
    case 'run_analysts': {
      const assessments = nodeOutput.analystAssessments as readonly unknown[] | undefined
      return { stage, message: `${assessments?.length ?? 4} specialist analysts completed assessments` }
    }
    case 'run_debate': {
      const debate = nodeOutput.debateResolution as { outcome?: string } | null
      return { stage, message: debate?.outcome ? `Debate outcome: ${debate.outcome}` : 'Bull vs Bear debate resolved' }
    }
    case 'assumptions_challenger':
      return { stage, message: 'Key assumptions challenged by risk team' }
    case 'magnitude_validator':
      return { stage, message: 'Dollar-impact magnitudes validated against historical data' }
    case 'portfolio_stress':
      return { stage, message: 'Monte Carlo stress test completed with VaR/CVaR' }
    case 'fund_manager':
      return { stage, message: 'Fund manager synthesized all inputs into calibrated verdict' }
    case 'judge': {
      const jv = nodeOutput.judgeVerdict as { convergenceReached?: boolean } | null
      return { stage, message: jv?.convergenceReached ? 'Quality evaluation passed' : 'Quality evaluation — requesting refinement' }
    }
    case 'generate_brief':
      return { stage, message: 'Research brief generated' }
    default:
      return { stage, message: `${nodeName} completed` }
  }
}

export async function runMultiAgentAnalysis(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userProfile: UserProfile
  readonly userExpectations?: UserExpectations
  readonly skipCheckpoints?: boolean
  readonly onProgress?: AnalysisProgressCallback
}): Promise<MultiAgentResult> {
  const {
    signal,
    portfolio,
    exposureMap,
    userProfile,
    userExpectations,
    skipCheckpoints = false,
    onProgress,
  } = params

  const compiled = skipCheckpoints
    ? compilePipelineNoCheckpoints()
    : compilePipeline()

  const config = skipCheckpoints
    ? {}
    : { configurable: { thread_id: `analysis-${signal.id}-${Date.now()}` } }

  const initialState = {
    signal,
    portfolio,
    exposureMap,
    userProfile,
    userExpectations: userExpectations ?? undefined,
    skipCheckpoints,
    riskProfile: null,
    marketData: null,
    debateResolution: null,
    humanCorrectionAtDebate: null,
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

  // Use .stream() for progressive updates when onProgress is provided
  if (onProgress) {
    const accumulated: Record<string, unknown> = { ...initialState }
    const stream = await compiled.stream(initialState, { ...config, streamMode: 'updates' as const })

    for await (const chunk of stream) {
      for (const [nodeName, nodeOutput] of Object.entries(chunk as Record<string, Record<string, unknown>>)) {
        Object.assign(accumulated, nodeOutput)
        const stageName = NODE_TO_STAGE[nodeName]
        if (stageName) {
          const summary = summarizeNodeOutput(nodeName, nodeOutput)
          onProgress(stageName, summary)
        }
      }
    }

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
