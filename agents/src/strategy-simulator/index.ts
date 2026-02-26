import type {
  StrategyConstraints,
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

  const scenario = {
    items: candidates.slice(0, Math.min(3, candidates.length)).map((candidate) => ({
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
      candidates,
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
