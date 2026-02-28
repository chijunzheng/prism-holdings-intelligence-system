// Pipeline Orchestrator — LangGraph StateGraph wiring all agents together.
// Stages: Preparation → Analysts → Debate → Risk Team → Synthesis → Brief
// Includes interrupt() for human-in-the-loop checkpoints.

import { StateGraph, START, END, interrupt, MemorySaver } from '@langchain/langgraph'
import { PipelineState } from './state.js'
import type { ScenarioPreference } from '@prism/shared'
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

// ── Node: Run All Analysts (parallel via Promise.all) ───────
async function runAnalystsNode(state: State): Promise<Partial<State>> {
  const assessments = await runAllAnalysts({
    signal: state.signal,
    portfolio: state.portfolio,
    exposureMap: state.exposureMap,
    riskProfile: state.riskProfile!,
    marketData: state.marketData ?? undefined,
  })
  return { analystAssessments: [...assessments] }
}

// ── Node: Run Debate ────────────────────────────────────────
async function runDebateNode(state: State): Promise<Partial<State>> {
  const debateResolution = await runDebate({
    analystAssessments: state.analystAssessments,
    signal: state.signal,
    exposureMap: state.exposureMap,
  })
  return { debateResolution }
}

// ── Node: Checkpoint 1 — After Debate ───────────────────────
// Pauses for human review of debate resolution.
// Human can provide correction text or approve.
async function checkpoint1Node(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints) return {}

  const humanInput = interrupt({
    stage: 'debate_resolution',
    debateResolution: state.debateResolution,
    prompt: 'Review the debate resolution. Provide corrections or approve to continue.',
  })

  if (typeof humanInput === 'string' && humanInput.length > 0) {
    return { humanCorrectionAtDebate: humanInput }
  }
  return {}
}

// ── Node: Assumptions Challenger ────────────────────────────
async function assumptionsChallengerNode(state: State): Promise<Partial<State>> {
  const riskChallenge = await runAssumptionsChallenger({
    analystAssessments: state.analystAssessments,
    humanCorrection: state.humanCorrectionAtDebate ?? undefined,
  })
  return { riskChallenge }
}

// ── Node: Magnitude Validator ───────────────────────────────
async function magnitudeValidatorNode(state: State): Promise<Partial<State>> {
  const allImpacts = state.debateResolution!.refinedHoldingImpacts
  const magnitudeValidation = runMagnitudeValidator({
    holdingImpacts: allImpacts,
    volatilities: state.marketData?.volatilities ?? {},
  })
  return { magnitudeValidation }
}

// ── Node: Portfolio Stress Test ─────────────────────────────
async function portfolioStressNode(state: State): Promise<Partial<State>> {
  const holdingValues = getHoldingValues(state.portfolio)
  const impacts = state.debateResolution!.refinedHoldingImpacts

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
  return { stressTest }
}

// ── Node: Checkpoint 2 — After Stress Test ──────────────────
async function checkpoint2Node(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints) return {}

  const humanInput = interrupt({
    stage: 'stress_test',
    stressTest: state.stressTest,
    prompt: 'Review stress test results. Choose scenario preference: base, downside, or tail.',
  })

  if (typeof humanInput === 'string' && ['base', 'downside', 'tail'].includes(humanInput)) {
    return { humanScenarioPreference: humanInput as ScenarioPreference }
  }
  return {}
}

// ── Node: Fund Manager Synthesis ────────────────────────────
async function fundManagerNode(state: State): Promise<Partial<State>> {
  const holdingValues = getHoldingValues(state.portfolio)
  const holdingNames = getHoldingNames(state.portfolio)

  const verdict = await runFundManager({
    signal: state.signal,
    debateResolution: state.debateResolution!,
    riskChallenge: state.riskChallenge!,
    magnitudeValidation: state.magnitudeValidation!,
    stressTest: state.stressTest!,
    riskProfile: state.riskProfile!,
    marketData: state.marketData!,
    holdingValues,
    holdingNames,
    userExpectations: state.userExpectations,
    scenarioPreference: state.humanScenarioPreference ?? undefined,
    judgeFeedback: state.judgeFeedback ?? undefined,
  })

  return {
    fundManagerVerdict: verdict,
    synthesisRound: state.synthesisRound + 1,
  }
}

// ── Node: Judge Quality Evaluator ───────────────────────────
async function judgeNode(state: State): Promise<Partial<State>> {
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

// ── Node: Generate Research Brief ───────────────────────────
async function generateBriefNode(state: State): Promise<Partial<State>> {
  const brief = await generateResearchBrief({
    signal: state.signal,
    verdict: state.fundManagerVerdict!,
    debateResolution: state.debateResolution!,
    riskChallenge: state.riskChallenge!,
    stressTest: state.stressTest!,
    judgeVerdict: state.judgeVerdict!,
  })
  return { researchBrief: brief }
}

// ── Conditional: Judge Loop ─────────────────────────────────
function shouldLoopBackToFundManager(state: State): string {
  const converged = state.judgeVerdict?.convergenceReached ?? false
  const maxIterations = state.synthesisRound >= 2

  if (converged || maxIterations) return 'generate_brief'
  return 'fund_manager'
}

// ── Build Graph ─────────────────────────────────────────────
export function buildPipelineGraph() {
  const graph = new StateGraph(PipelineState)
    .addNode('infer_risk_profile', inferRiskProfileNode)
    .addNode('fetch_market_data', fetchMarketDataNode)
    .addNode('run_analysts', runAnalystsNode)
    .addNode('run_debate', runDebateNode)
    .addNode('checkpoint_1', checkpoint1Node)
    .addNode('assumptions_challenger', assumptionsChallengerNode)
    .addNode('magnitude_validator', magnitudeValidatorNode)
    .addNode('portfolio_stress', portfolioStressNode)
    .addNode('checkpoint_2', checkpoint2Node)
    .addNode('fund_manager', fundManagerNode)
    .addNode('judge', judgeNode)
    .addNode('generate_brief', generateBriefNode)

    // Linear flow: start → prep → analysts → debate → risk → synthesis → brief
    .addEdge(START, 'infer_risk_profile')
    .addEdge('infer_risk_profile', 'fetch_market_data')
    .addEdge('fetch_market_data', 'run_analysts')
    .addEdge('run_analysts', 'run_debate')
    .addEdge('run_debate', 'checkpoint_1')
    .addEdge('checkpoint_1', 'assumptions_challenger')
    .addEdge('assumptions_challenger', 'magnitude_validator')
    .addEdge('magnitude_validator', 'portfolio_stress')
    .addEdge('portfolio_stress', 'checkpoint_2')
    .addEdge('checkpoint_2', 'fund_manager')
    .addEdge('fund_manager', 'judge')

    // Judge → conditional: either loop back to fund_manager or proceed to brief
    .addConditionalEdges('judge', shouldLoopBackToFundManager, {
      fund_manager: 'fund_manager',
      generate_brief: 'generate_brief',
    })
    .addEdge('generate_brief', END)

  return graph
}

// ── Compile with checkpointer ───────────────────────────────
export function compilePipeline() {
  const graph = buildPipelineGraph()
  const checkpointer = new MemorySaver()
  return graph.compile({ checkpointer })
}

// ── Compile without checkpoints (for eval/testing) ──────────
export function compilePipelineNoCheckpoints() {
  const graph = buildPipelineGraph()
  return graph.compile()
}
