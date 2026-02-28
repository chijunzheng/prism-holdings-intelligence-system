import type {
  Portfolio,
  StrategyConstraints,
  StrategyCandidate,
  StrategyDraft,
  StrategyDraftRequest,
  StrategyEvaluateRequest,
  StrategyObjective,
  Signal,
} from '@prism/shared'
import type { TemporalAnalysis } from '../temporal-reasoner/types'
import type { PipelineContext } from '../orchestrator/index'
import {
  runGraphPipeline,
  runPortfolioNetImpactPipeline,
  runSignalMonitor,
  runExposureAnalysis,
} from '../orchestrator/index'
import type { AgentResult } from '../types'
import { generateMitigationCandidates } from '../strategy-candidate-engine/index'
import { evaluateScenarioModel } from './scoring'

const DEFAULT_MAX_CANDIDATES = 5
const STRATEGY_OBJECTIVE: StrategyObjective =
  'minimize_one_month_downside_with_six_month_guardrail'

const MODEL_REFERENCE_PRICES_CAD: Readonly<Record<string, number>> = {
  CASH: 1,
  ZAG: 15.2,
  XIC: 37.4,
  ZEB: 43.8,
  ZDV: 19.1,
  VFV: 122.8,
  XQQ: 153.4,
  XEG: 18.5,
  XGD: 18.2,
  CNQ: 97.1,
  SU: 48.6,
  RY: 145.4,
  TD: 84.2,
  BNS: 70.6,
  BMO: 128.3,
  CM: 68.9,
  NA: 114.7,
  NEM: 61.5,
  ABX: 29.3,
  AEM: 86.8,
}

function riskTurnoverCap(riskTolerance: string): number {
  if (riskTolerance === 'low') return 3
  if (riskTolerance === 'high') return 7
  return 5
}

function buildConstraints(
  riskTolerance: string,
  explicitOverride: boolean,
  requestedTurnoverCapPct?: number,
): StrategyConstraints {
  const profileCap = riskTurnoverCap(riskTolerance)
  const hardMax = 10

  let turnoverCapPct = profileCap
  if (explicitOverride && typeof requestedTurnoverCapPct === 'number') {
    turnoverCapPct = Math.min(hardMax, Math.max(profileCap, requestedTurnoverCapPct))
  }

  return {
    turnoverCapPct,
    hardMaxTurnoverPct: hardMax,
    allowCashBuffer: true,
    taxAware: true,
    noMicrocaps: true,
    excludeLeveragedEtfs: true,
    maxNewPositions: 2,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildHoldingPriceMap(portfolio: Portfolio): ReadonlyMap<string, number> {
  const priceMap = new Map<string, number>()
  for (const account of portfolio.accounts) {
    for (const holding of account.holdings) {
      const ticker = holding.ticker.trim().toUpperCase()
      if (!ticker || holding.units <= 0) continue
      const implied = holding.valueCad / holding.units
      if (Number.isFinite(implied) && implied > 0) {
        priceMap.set(ticker, implied)
      }
    }
  }
  return priceMap
}

function resolveReferencePrice(
  ticker: string,
  holdingPriceMap: ReadonlyMap<string, number>,
): { readonly priceCad: number | null; readonly source: 'holding_implied' | 'model_estimate' | 'unavailable' } {
  const normalized = ticker.trim().toUpperCase()
  const holdingPrice = holdingPriceMap.get(normalized)
  if (typeof holdingPrice === 'number' && holdingPrice > 0) {
    return { priceCad: holdingPrice, source: 'holding_implied' }
  }
  const modelPrice = MODEL_REFERENCE_PRICES_CAD[normalized]
  if (typeof modelPrice === 'number' && modelPrice > 0) {
    return { priceCad: modelPrice, source: 'model_estimate' }
  }
  return { priceCad: null, source: 'unavailable' }
}

function buildPositionSuggestion(
  portfolioTotalCad: number,
  allocationPct: number,
  priceCad: number | null,
  type: StrategyCandidate['type'],
): StrategyCandidate['positionSuggestion'] {
  const targetCad = Math.max(0, portfolioTotalCad * Math.max(allocationPct, 0) / 100)
  if (type === 'cash') {
    return {
      targetCad,
      estimatedShares: null,
      estimatedTradeCad: targetCad,
      residualCad: 0,
    }
  }
  if (!priceCad || priceCad <= 0) {
    return {
      targetCad,
      estimatedShares: null,
      estimatedTradeCad: null,
      residualCad: null,
    }
  }
  const estimatedShares = Math.max(0, Math.floor(targetCad / priceCad))
  const estimatedTradeCad = estimatedShares * priceCad
  const residualCad = clamp(targetCad - estimatedTradeCad, 0, targetCad)
  return {
    targetCad,
    estimatedShares,
    estimatedTradeCad,
    residualCad,
  }
}

async function resolveSignalForDraft(
  ctx: PipelineContext,
  signalId?: string,
): Promise<
  | {
      readonly signalId: string | null
      readonly signalHeadline: string | null
      readonly oneMonthCad: number
      readonly sixMonthCad: number
      readonly signal: Signal | null
      readonly temporal: TemporalAnalysis | null
    }
  | null
> {
  if (signalId) {
    const graph = await runGraphPipeline(ctx, signalId)
    if (graph.success && graph.data) {
      return {
        signalId: graph.data.signal.id,
        signalHeadline: graph.data.signal.headline,
        oneMonthCad: graph.data.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact,
        sixMonthCad: graph.data.temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact,
        signal: graph.data.signal,
        temporal: graph.data.temporalAnalysis,
      }
    }
  }

  const exposure = await runExposureAnalysis(ctx)
  if (!exposure.success || !exposure.data) return null

  const signalResult = await runSignalMonitor(exposure.data)
  const topSignal = signalResult.data?.[0]
  if (!topSignal) {
    const net = await runPortfolioNetImpactPipeline(ctx)
    if (!net.success || !net.data) return null
    return {
      signalId: null,
      signalHeadline: null,
      oneMonthCad: net.data.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact,
      sixMonthCad: net.data.temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact,
      signal: null,
      temporal: net.data.temporalAnalysis,
    }
  }

  const graph = await runGraphPipeline(ctx, topSignal.id)
  if (!graph.success || !graph.data) {
    return {
      signalId: topSignal.id,
      signalHeadline: topSignal.headline,
      oneMonthCad: -900,
      sixMonthCad: -450,
      signal: topSignal,
      temporal: null,
    }
  }

  return {
    signalId: graph.data.signal.id,
    signalHeadline: graph.data.signal.headline,
    oneMonthCad: graph.data.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact,
    sixMonthCad: graph.data.temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact,
    signal: graph.data.signal,
    temporal: graph.data.temporalAnalysis,
  }
}

export async function buildStrategyDraft(
  ctx: PipelineContext,
  request: StrategyDraftRequest,
): Promise<AgentResult<StrategyDraft>> {
  const start = performance.now()

  const constraints = buildConstraints(
    ctx.profile.riskTolerance,
    Boolean(request.explicitOverride),
    request.requestedTurnoverCapPct,
  )

  const exposure = await runExposureAnalysis(ctx)
  if (!exposure.success || !exposure.data) {
    return {
      success: false,
      error: exposure.error ?? 'Exposure analysis failed for strategy draft',
      durationMs: performance.now() - start,
    }
  }

  const resolved = await resolveSignalForDraft(ctx, request.signalId)
  if (!resolved) {
    return {
      success: false,
      error: 'Unable to resolve signal or baseline impact for strategy draft',
      durationMs: performance.now() - start,
    }
  }

  const maxCandidates = request.maxCandidates ?? DEFAULT_MAX_CANDIDATES
  const candidates = generateMitigationCandidates({
    portfolio: ctx.portfolio,
    exposureMap: exposure.data,
    signal: resolved.signal,
    temporalAnalysis: resolved.temporal,
    constraints,
    maxCandidates,
    getFundComposition: ctx.getFundComposition,
  })
  const holdingPriceMap = buildHoldingPriceMap(ctx.portfolio)
  const quoteAsOf = new Date().toISOString()

  const enrichedCandidates: ReadonlyArray<StrategyCandidate> = candidates.map((candidate) => {
    const resolvedPrice = resolveReferencePrice(candidate.ticker, holdingPriceMap)
    const suggestion = buildPositionSuggestion(
      ctx.portfolio.totalValueCad,
      candidate.proposedShiftPct,
      resolvedPrice.priceCad,
      candidate.type,
    )

    return {
      ...candidate,
      referencePriceCad: resolvedPrice.priceCad ?? undefined,
      quoteSource: resolvedPrice.source,
      quoteAsOf,
      positionSuggestion: suggestion,
    }
  })

  const scenario = {
    items: enrichedCandidates.slice(0, Math.min(3, enrichedCandidates.length)).map((candidate) => ({
      candidateId: candidate.id,
      ticker: candidate.ticker,
      name: candidate.name,
      type: candidate.type,
      rationale: candidate.rationale,
      confidence: candidate.confidence,
      expectedMitigationCad: candidate.expectedMitigationCad,
      diversificationScore: candidate.diversificationScore,
      estimatedTurnoverCostCad: candidate.estimatedTurnoverCostCad,
      estimatedTaxCostCad: candidate.estimatedTaxCostCad,
      allocationPct: candidate.proposedShiftPct,
    })),
  }

  return {
    success: true,
    data: {
      signalId: resolved.signalId,
      signalHeadline: resolved.signalHeadline,
      generatedAt: new Date().toISOString(),
      objective: STRATEGY_OBJECTIVE,
      constraints,
      candidates: enrichedCandidates,
      scenario,
      baselineOneMonthCad: resolved.oneMonthCad,
      baselineSixMonthCad: resolved.sixMonthCad,
      seedSummary: request.seedSummary ?? null,
      humanDecisionRequired: true,
    },
    durationMs: performance.now() - start,
  }
}

export async function evaluateStrategyScenario(
  ctx: PipelineContext,
  request: StrategyEvaluateRequest,
): Promise<AgentResult<import('@prism/shared').StrategyEvaluation>> {
  const start = performance.now()

  const draft = await buildStrategyDraft(ctx, {
    signalId: request.signalId,
    explicitOverride: request.explicitOverride,
    requestedTurnoverCapPct: request.requestedTurnoverCapPct,
    maxCandidates: DEFAULT_MAX_CANDIDATES,
  })

  if (!draft.success || !draft.data) {
    return {
      success: false,
      error: draft.error ?? 'Unable to evaluate strategy scenario',
      durationMs: performance.now() - start,
    }
  }

  const evaluation = evaluateScenarioModel({
    objective: STRATEGY_OBJECTIVE,
    scenario: request.scenario,
    constraints: draft.data.constraints,
    baselineOneMonthCad: draft.data.baselineOneMonthCad,
    baselineSixMonthCad: draft.data.baselineSixMonthCad,
    portfolio: ctx.portfolio,
  })

  return {
    success: true,
    data: evaluation,
    durationMs: performance.now() - start,
  }
}
