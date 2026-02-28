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
  } = params

  const compiled = skipCheckpoints
    ? compilePipelineNoCheckpoints()
    : compilePipeline()

  const config = skipCheckpoints
    ? {}
    : { configurable: { thread_id: `analysis-${signal.id}-${Date.now()}` } }

  const result = await compiled.invoke(
    {
      signal,
      portfolio,
      exposureMap,
      userProfile,
      userExpectations: userExpectations ?? undefined,
      skipCheckpoints,
      // Initialize nullable fields
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
    },
    config,
  )

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
