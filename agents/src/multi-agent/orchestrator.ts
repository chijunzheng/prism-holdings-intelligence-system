// Pipeline Orchestrator — LangGraph StateGraph wiring all agents together.
// Stages: Preparation → Analysts → Debate → Risk Team → Synthesis → Brief
// Includes interrupt() for human-in-the-loop checkpoints.

import { StateGraph, START, END, interrupt, MemorySaver } from '@langchain/langgraph'
import { PipelineState } from './state.js'
import type { ThinkingCallback } from './types.js'
import { inferRiskProfile } from './risk-profile-inference.js'
import { getMarketDataForAnalysis } from './market-data.js'
import { runAllAnalysts } from './analysts/index.js'
import { runDebate } from './researchers/index.js'
import { runAssumptionsChallenger } from './risk-team/index.js'
import { runMagnitudeValidator } from './risk-team/index.js'
import { runPortfolioStressTest } from './risk-team/index.js'
import { runFundManager } from './fund-manager.js'
import { runJudge } from './judge.js'
import { generateResearchBrief } from './research-brief.js'

type State = typeof PipelineState.State

// ── Helper: extract all tickers from portfolio ──────────────
function getPortfolioTickers(portfolio: State['portfolio']): readonly string[] {
  return portfolio.accounts.flatMap((acct) =>
    acct.holdings.map((h) => h.ticker),
  )
}

function getHoldingValues(portfolio: State['portfolio']): Readonly<Record<string, number>> {
  const values: Record<string, number> = {}
  for (const acct of portfolio.accounts) {
    for (const h of acct.holdings) {
      values[h.ticker] = (values[h.ticker] ?? 0) + h.valueCad
    }
  }
  return values
}

function getHoldingNames(portfolio: State['portfolio']): Readonly<Record<string, string>> {
  const names: Record<string, string> = {}
  for (const acct of portfolio.accounts) {
    for (const h of acct.holdings) {
      if (!names[h.ticker]) names[h.ticker] = h.name
    }
  }
  return names
}

// ── Node: Infer Risk Profile ────────────────────────────────
async function inferRiskProfileNode(state: State): Promise<Partial<State>> {
  const riskProfile = inferRiskProfile({
    portfolio: state.portfolio,
    exposureMap: state.exposureMap,
    userExpectations: state.userExpectations,
  })
  return { riskProfile }
}

// ── Node: Fetch Market Data ─────────────────────────────────
async function fetchMarketDataNode(state: State): Promise<Partial<State>> {
  const tickers = getPortfolioTickers(state.portfolio)
  const marketData = await getMarketDataForAnalysis(tickers)
  return { marketData }
}

// ── Node Factories (capture onThinking via closure) ─────────
function createRunAnalystsNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    const assessments = await runAllAnalysts({
      signal: state.signal,
      portfolio: state.portfolio,
      exposureMap: state.exposureMap,
      riskProfile: state.riskProfile!,
      marketData: state.marketData ?? undefined,
      onThinking,
    })
    return { analystAssessments: [...assessments] }
  }
}

function createRunDebateNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    const debateResolution = await runDebate({
      analystAssessments: state.analystAssessments,
      signal: state.signal,
      exposureMap: state.exposureMap,
      humanCorrectionPreDebate: state.humanCorrectionPreDebate ?? undefined,
      onThinking,
    })
    return { debateResolution }
  }
}

// ── Soft Checkpoint: Post-Debate ─────────────────────────────
// Auto-continue after timeout. If user intervenes, their correction
// is passed to the risk team and fund manager.
async function softCheckpointPostDebate(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints || state.pipelineMode === 'quick') return {}

  const humanInput = interrupt({
    stage: 'debate_resolution',
    type: 'soft',
    debateResolution: state.debateResolution,
    prompt: 'Review debate outcome before risk analysis begins.',
  })

  if (typeof humanInput === 'string' && humanInput !== 'continue') {
    return { humanCorrectionAtDebate: humanInput }
  }
  return {}
}

function createAssumptionsChallengerNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    onThinking?.('risk_challenge', 'Stress-testing analyst assumptions — identifying blind spots and biases in the consensus view...')
    const riskChallenge = await runAssumptionsChallenger({
      analystAssessments: state.analystAssessments,
      humanCorrection: state.humanCorrectionAtDebate ?? undefined,
    })
    const challengeCount = riskChallenge.challengedAssumptions.length
    const haircut = Math.round(riskChallenge.recommendedConfidenceAdjustment * 100)
    onThinking?.('risk_challenge', `Found ${challengeCount} challenged assumption${challengeCount !== 1 ? 's' : ''}. Recommended confidence haircut: ${haircut}%`)
    return { riskChallenge }
  }
}

// ── Node: Magnitude Validator ───────────────────────────────
function createMagnitudeValidatorNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    onThinking?.('magnitude_validation', 'Validating dollar-impact estimates against historical volatility bounds...')
    const allImpacts = state.debateResolution?.refinedHoldingImpacts ?? []
    if (allImpacts.length === 0) {
      onThinking?.('magnitude_validation', 'No holding impacts available for validation — skipping')
      return {
        magnitudeValidation: {
          holdingValidations: [],
          outOfBoundsFlags: [],
          overallAssessment: 'No holding impact data available for validation.',
        },
      }
    }
    const magnitudeValidation = runMagnitudeValidator({
      holdingImpacts: allImpacts,
      volatilities: state.marketData?.volatilities ?? {},
    })
    const outOfBoundsCount = magnitudeValidation.holdingValidations.filter((v) => v.outOfBounds).length
    const totalCount = magnitudeValidation.holdingValidations.length
    const msg = outOfBoundsCount > 0
      ? `${outOfBoundsCount} of ${totalCount} holdings clamped to reasonable ranges based on historical volatility`
      : `All ${totalCount} holding estimates within historical volatility bounds`
    onThinking?.('magnitude_validation', msg)
    return { magnitudeValidation }
  }
}

// ── Node: Portfolio Stress Test ─────────────────────────────
function createPortfolioStressNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    onThinking?.('stress_complete', 'Running Monte Carlo simulation (10,000 scenarios) with real correlation matrix...')
    const holdingValues = getHoldingValues(state.portfolio)
    const impacts = state.debateResolution?.refinedHoldingImpacts ?? []

    if (impacts.length === 0) {
      onThinking?.('stress_complete', 'No holding impacts available — using zero-impact stress test')
      const zeroRange = { low: 0, mid: 0, high: 0 }
      return {
        stressTest: {
          numSimulations: 0,
          baseCase: zeroRange,
          downside: zeroRange,
          tailRisk: zeroRange,
          reversalProbability: 0,
          scenarios: [],
          holdingBreakdown: [],
        },
      }
    }

    const holdings = impacts.map((impact) => ({
      ticker: impact.ticker,
      holdingValueCad: holdingValues[impact.ticker] ?? 0,
      expectedReturn: impact.direction * impact.magnitudeScore,
      volatility: state.marketData?.volatilities[impact.ticker]?.monthly ?? 0.05,
    }))

    const stressTest = runPortfolioStressTest({
      holdings,
      correlationMatrix: state.marketData?.correlationMatrix ?? holdings.map((_, i) =>
        holdings.map((_, j) => (i === j ? 1 : 0)),
      ),
    })

    const baseMid = stressTest.baseCase.mid
    const var95 = stressTest.downside.mid
    const reversalPct = Math.round((stressTest.reversalProbability ?? 0) * 100)
    onThinking?.('stress_complete', `Base case: $${baseMid.toLocaleString()}, 95% VaR: $${var95.toLocaleString()}, ${reversalPct}% reversal probability`)
    return { stressTest }
  }
}

// ── Node: Checkpoint 2 — After Stress Test ──────────────────
// Auto-selects base case scenario. Previously interrupted for user selection,
// but the stress test picker added friction without meaningful user input.
async function checkpoint2Node(_state: State): Promise<Partial<State>> {
  return {}
}

function createFundManagerNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    const holdingValues = getHoldingValues(state.portfolio)
    const holdingNames = getHoldingNames(state.portfolio)

    onThinking?.('verdict', 'Synthesizing all inputs — balancing debate outcome, risk challenges, and stress scenarios into calibrated dollar-impact ranges...')

    if (!state.debateResolution || !state.riskChallenge || !state.magnitudeValidation || !state.stressTest || !state.riskProfile || !state.marketData) {
      const missing = [
        !state.debateResolution && 'debateResolution',
        !state.riskChallenge && 'riskChallenge',
        !state.magnitudeValidation && 'magnitudeValidation',
        !state.stressTest && 'stressTest',
        !state.riskProfile && 'riskProfile',
        !state.marketData && 'marketData',
      ].filter(Boolean).join(', ')
      onThinking?.('verdict', `Missing required data (${missing}) — cannot synthesize verdict`)
      throw new Error(`Fund manager missing required state: ${missing}`)
    }

    const verdict = await runFundManager({
      signal: state.signal,
      debateResolution: state.debateResolution,
      riskChallenge: state.riskChallenge,
      magnitudeValidation: state.magnitudeValidation,
      stressTest: state.stressTest,
      riskProfile: state.riskProfile,
      marketData: state.marketData,
      holdingValues,
      holdingNames,
      userExpectations: state.userExpectations,
      scenarioPreference: state.humanScenarioPreference ?? undefined,
      judgeFeedback: state.judgeFeedback ?? undefined,
      onThinking,
    })

    return {
      fundManagerVerdict: verdict,
      synthesisRound: state.synthesisRound + 1,
    }
  }
}

function createJudgeNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    onThinking?.('judge', 'Evaluating verdict quality — checking calibration, internal consistency, and whether recommendations are actionable...')
    const judgeVerdict = await runJudge({
      verdict: state.fundManagerVerdict!,
      signal: state.signal,
      analystAssessments: state.analystAssessments,
      iteration: state.synthesisRound - 1,
    })

    return {
      judgeVerdict,
      judgeFeedback: judgeVerdict.convergenceReached ? null : (judgeVerdict.feedback ?? null),
    }
  }
}

// ── Node: Generate Research Brief ───────────────────────────
function createGenerateBriefNode(onThinking?: ThinkingCallback) {
  return async (state: State): Promise<Partial<State>> => {
    onThinking?.('brief', 'Compiling research brief with full audit trail...')

    if (!state.fundManagerVerdict || !state.debateResolution || !state.riskChallenge || !state.stressTest || !state.judgeVerdict) {
      onThinking?.('brief', 'Missing required data — cannot generate research brief')
      throw new Error('Research brief missing required pipeline state')
    }

    const brief = await generateResearchBrief({
      signal: state.signal,
      verdict: state.fundManagerVerdict,
      debateResolution: state.debateResolution,
      riskChallenge: state.riskChallenge,
      stressTest: state.stressTest,
      judgeVerdict: state.judgeVerdict,
    })
    onThinking?.('brief', 'Research brief generated — all agent reasoning, debate transcript, and computational derivation documented')
    return { researchBrief: brief }
  }
}

// ── Soft Checkpoint: Post-Analysts ───────────────────────────
// Auto-continue after timeout. If user intervenes, their correction
// is passed to the debate researchers.
async function softCheckpointPostAnalysts(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints || state.pipelineMode === 'quick') return {}

  const humanInput = interrupt({
    stage: 'analyst_review',
    type: 'soft',
    analystAssessments: state.analystAssessments,
    riskProfile: state.riskProfile,
    prompt: 'Review analyst perspectives before debate begins.',
  })

  if (typeof humanInput === 'string' && humanInput !== 'continue') {
    return { humanCorrectionPreDebate: humanInput }
  }
  return {}
}

// ── Soft Checkpoint: Post-Risk-Challenge ────────────────────
async function softCheckpointPostRiskChallenge(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints || state.pipelineMode === 'quick') return {}

  const humanInput = interrupt({
    stage: 'risk_challenge_review',
    type: 'soft',
    riskChallenge: state.riskChallenge,
    magnitudeValidation: state.magnitudeValidation,
    stressTest: state.stressTest,
    prompt: 'Review challenged assumptions.',
  })

  if (typeof humanInput === 'string' && humanInput !== 'continue') {
    return { humanRiskChallengeOverrides: humanInput }
  }
  return {}
}

// ── Soft Checkpoint: Post-Verdict ───────────────────────────
async function softCheckpointPostVerdict(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints || state.pipelineMode === 'quick') return {}
  if (!state.judgeVerdict?.convergenceReached) return {}

  const humanInput = interrupt({
    stage: 'verdict_preview',
    type: 'soft',
    verdict: state.fundManagerVerdict,
    qualityScore: state.judgeVerdict?.overallQualityScore,
    prompt: 'Preview verdict before generating research brief.',
  })

  if (typeof humanInput === 'string' && humanInput !== 'continue' && humanInput !== 'accept') {
    return { judgeFeedback: humanInput, synthesisRound: 0 }
  }
  return {}
}

// ── Conditional: Judge Loop ─────────────────────────────────
function shouldLoopBackToFundManager(state: State): string {
  const converged = state.judgeVerdict?.convergenceReached ?? false
  const maxIterations = state.synthesisRound >= 2

  if (converged || maxIterations) return 'soft_cp_verdict'
  return 'fund_manager'
}

// ── Build Graph ─────────────────────────────────────────────
export function buildPipelineGraph(onThinking?: ThinkingCallback) {
  const graph = new StateGraph(PipelineState)
    .addNode('infer_risk_profile', inferRiskProfileNode)
    .addNode('fetch_market_data', fetchMarketDataNode)
    .addNode('run_analysts', createRunAnalystsNode(onThinking))
    .addNode('soft_cp_analysts', softCheckpointPostAnalysts)
    .addNode('run_debate', createRunDebateNode(onThinking))
    .addNode('checkpoint_1', checkpoint1Node)
    .addNode('assumptions_challenger', createAssumptionsChallengerNode(onThinking))
    .addNode('magnitude_validator', createMagnitudeValidatorNode(onThinking))
    .addNode('portfolio_stress', createPortfolioStressNode(onThinking))
    .addNode('soft_cp_risk_challenge', softCheckpointPostRiskChallenge)
    .addNode('checkpoint_2', checkpoint2Node)
    .addNode('fund_manager', createFundManagerNode(onThinking))
    .addNode('judge', createJudgeNode(onThinking))
    .addNode('soft_cp_verdict', softCheckpointPostVerdict)
    .addNode('generate_brief', createGenerateBriefNode(onThinking))

    // Parallel prep: risk profile + market data run concurrently, both fan into analysts
    .addEdge(START, 'infer_risk_profile')
    .addEdge(START, 'fetch_market_data')
    .addEdge('infer_risk_profile', 'run_analysts')
    .addEdge('fetch_market_data', 'run_analysts')
    // Soft checkpoint: post-analysts (user can review before debate)
    .addEdge('run_analysts', 'soft_cp_analysts')
    .addEdge('soft_cp_analysts', 'run_debate')
    .addEdge('run_debate', 'checkpoint_1')
    // Parallel risk team: all three read from earlier stages only, no cross-dependencies
    .addEdge('checkpoint_1', 'assumptions_challenger')
    .addEdge('checkpoint_1', 'magnitude_validator')
    .addEdge('checkpoint_1', 'portfolio_stress')
    // Soft checkpoint: post-risk-challenge (after all three risk agents complete)
    .addEdge('assumptions_challenger', 'soft_cp_risk_challenge')
    .addEdge('magnitude_validator', 'soft_cp_risk_challenge')
    .addEdge('portfolio_stress', 'soft_cp_risk_challenge')
    .addEdge('soft_cp_risk_challenge', 'checkpoint_2')
    .addEdge('checkpoint_2', 'fund_manager')
    .addEdge('fund_manager', 'judge')

    // Judge → conditional: either loop back to fund_manager or proceed to soft verdict checkpoint
    .addConditionalEdges('judge', shouldLoopBackToFundManager, {
      fund_manager: 'fund_manager',
      soft_cp_verdict: 'soft_cp_verdict',
    })
    .addEdge('soft_cp_verdict', 'generate_brief')
    .addEdge('generate_brief', END)

  return graph
}

// ── Shared Checkpointer ─────────────────────────────────────
// Module-scoped so checkpoint state persists between initial request and resume.
const sharedCheckpointer = new MemorySaver()

// ── Compile with checkpointer ───────────────────────────────
export function compilePipeline(onThinking?: ThinkingCallback) {
  const graph = buildPipelineGraph(onThinking)
  return graph.compile({ checkpointer: sharedCheckpointer })
}

// ── Compile without checkpoints (for eval/testing) ──────────
export function compilePipelineNoCheckpoints(onThinking?: ThinkingCallback) {
  const graph = buildPipelineGraph(onThinking)
  return graph.compile()
}
