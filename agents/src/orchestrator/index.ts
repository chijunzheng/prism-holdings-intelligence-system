import type { Signal, ExposureMap, CausalChain, UserProfile, Portfolio, FundComposition } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { analyze } from '../exposure-analyzer/index'
import { monitor } from '../signal-monitor/index'
import { propagate } from '../causal-propagation/index'
import { classify } from '../temporal-reasoner/index'
import type { TemporalAnalysis } from '../temporal-reasoner/types'

export const config: AgentConfig = {
  name: 'orchestrator',
  description: 'Coordinates agent pipeline execution with caching',
  usesLlm: false,
}

// ── Caching ──────────────────────────────────────────

interface CacheEntry<T> {
  readonly data: T
  readonly cachedAt: number
}

const exposureCache = new Map<string, CacheEntry<ExposureMap>>()
const signalCache = new Map<string, CacheEntry<ReadonlyArray<Signal>>>()

const SIGNAL_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCachedExposure(portfolioId: string): ExposureMap | null {
  const entry = exposureCache.get(portfolioId)
  return entry?.data ?? null
}

function getCachedSignals(portfolioId: string): ReadonlyArray<Signal> | null {
  const entry = signalCache.get(portfolioId)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > SIGNAL_CACHE_TTL_MS) {
    signalCache.delete(portfolioId)
    return null
  }
  return entry.data
}

// ── Pipeline Context ─────────────────────────────────

export interface PipelineContext {
  readonly portfolio: Portfolio
  readonly profile: UserProfile
  readonly getFundComposition: (ticker: string) => FundComposition | undefined
}

// ── Pipeline Steps ───────────────────────────────────

export async function runExposureAnalysis(
  ctx: PipelineContext,
): Promise<AgentResult<ExposureMap>> {
  const cached = getCachedExposure(ctx.portfolio.userId)
  if (cached) {
    return { success: true, data: cached, durationMs: 0 }
  }

  const result = await analyze(ctx.portfolio, ctx.getFundComposition)
  if (result.success && result.data) {
    exposureCache.set(ctx.portfolio.userId, { data: result.data, cachedAt: Date.now() })
  }
  return result
}

export async function runSignalMonitor(
  exposureMap: ExposureMap,
): Promise<AgentResult<ReadonlyArray<Signal>>> {
  const cached = getCachedSignals(exposureMap.portfolioId)
  if (cached) {
    return { success: true, data: cached, durationMs: 0 }
  }

  const result = await monitor(exposureMap)
  if (result.success && result.data) {
    signalCache.set(exposureMap.portfolioId, { data: result.data, cachedAt: Date.now() })
  }
  return result
}

export async function runCausalPropagation(
  signal: Signal,
  exposureMap: ExposureMap,
): Promise<AgentResult<CausalChain>> {
  return propagate(signal, exposureMap)
}

export async function runTemporalReasoning(
  chain: CausalChain,
  profile: UserProfile,
): Promise<AgentResult<TemporalAnalysis>> {
  return classify(chain, profile)
}

// ── Full Pipeline ────────────────────────────────────

export interface GraphPipelineResult {
  readonly signal: Signal
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
}

export async function runGraphPipeline(
  ctx: PipelineContext,
  signalId: string,
): Promise<AgentResult<GraphPipelineResult>> {
  const start = performance.now()

  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) {
    return { success: false, error: exposureResult.error ?? 'Exposure analysis failed', durationMs: performance.now() - start }
  }

  const signalResult = await runSignalMonitor(exposureResult.data)
  if (!signalResult.success || !signalResult.data) {
    return { success: false, error: signalResult.error ?? 'Signal monitoring failed', durationMs: performance.now() - start }
  }

  const signal = signalResult.data.find((s) => s.id === signalId)
  if (!signal) {
    return { success: false, error: 'Signal not found', durationMs: performance.now() - start }
  }

  const chainResult = await runCausalPropagation(signal, exposureResult.data)
  if (!chainResult.success || !chainResult.data) {
    return { success: false, error: chainResult.error ?? 'Causal chain generation failed', durationMs: performance.now() - start }
  }

  const temporalResult = await runTemporalReasoning(chainResult.data, ctx.profile)
  if (!temporalResult.success || !temporalResult.data) {
    return { success: false, error: temporalResult.error ?? 'Temporal reasoning failed', durationMs: performance.now() - start }
  }

  return {
    success: true,
    data: {
      signal,
      chain: chainResult.data,
      temporalAnalysis: temporalResult.data,
    },
    durationMs: performance.now() - start,
  }
}

/**
 * Clears all caches — used when profile switches.
 */
export function clearCaches(): void {
  exposureCache.clear()
  signalCache.clear()
}
