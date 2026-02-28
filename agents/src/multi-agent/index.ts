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
} from '@prism/shared'

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
 */
export async function runMultiAgentAnalysis(_params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userExpectations?: UserExpectations
  readonly skipCheckpoints?: boolean
  readonly onProgress?: AnalysisProgressCallback
}): Promise<MultiAgentResult> {
  throw new Error('Not yet implemented — see plans/multi-agent-pipeline/')
}

/**
 * Run portfolio review mode: analyze multiple signals in parallel,
 * then synthesize cross-signal interactions into a unified PortfolioVerdict.
 */
export async function runPortfolioReview(_params: {
  readonly signals: readonly Signal[]
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly userExpectations?: UserExpectations
  readonly onProgress?: AnalysisProgressCallback
}): Promise<PortfolioVerdict> {
  throw new Error('Not yet implemented — see plans/multi-agent-pipeline/')
}
