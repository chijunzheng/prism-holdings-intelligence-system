import type { Signal, ExposureMap, CausalChain, UserProfile, Portfolio, FundComposition } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { analyze } from '../exposure-analyzer/index'
import { monitor, clearCache as clearSignalMonitorCache } from '../signal-monitor/index'
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
const causalChainCache = new Map<string, CacheEntry<CausalChain>>()

const SIGNAL_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const CHAIN_CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

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

function getCachedChain(signalId: string): CausalChain | null {
  const entry = causalChainCache.get(signalId)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CHAIN_CACHE_TTL_MS) {
    causalChainCache.delete(signalId)
    return null
  }
  return entry.data
}

/**
 * Looks up a signal by ID from the orchestrator's signal cache
 * without re-running the signal monitor.
 */
function findCachedSignal(signalId: string): Signal | null {
  for (const entry of signalCache.values()) {
    const match = entry.data.find((s) => s.id === signalId)
    if (match) return match
  }
  return null
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
  const cached = getCachedChain(signal.id)
  if (cached) {
    return { success: true, data: cached, durationMs: 0 }
  }

  const result = await propagate(signal, exposureMap)
  if (result.success && result.data) {
    causalChainCache.set(signal.id, { data: result.data, cachedAt: Date.now() })
  }
  return result
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

  // Step 1: Exposure analysis (fast, usually cached)
  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) {
    return { success: false, error: exposureResult.error ?? 'Exposure analysis failed', durationMs: performance.now() - start }
  }

  // Optimization: Try to find the signal in cache directly, avoiding
  // a full signal monitor re-run just to look up a known signal ID.
  const cachedSignal = findCachedSignal(signalId)

  // Step 2 + Step 3: Run signal monitor (only if signal not in cache)
  // and causal propagation in parallel when possible.
  let signal: Signal | undefined
  let chainResult: AgentResult<CausalChain>

  if (cachedSignal) {
    // Fast path: signal is cached, skip monitor entirely → go straight to causal propagation
    signal = cachedSignal
    chainResult = await runCausalPropagation(signal, exposureResult.data)
  } else {
    // Slow path: need to run signal monitor first to get the signal object
    const signalResult = await runSignalMonitor(exposureResult.data)
    if (!signalResult.success || !signalResult.data) {
      return { success: false, error: signalResult.error ?? 'Signal monitoring failed', durationMs: performance.now() - start }
    }

    signal = signalResult.data.find((s) => s.id === signalId)
    if (!signal) {
      return { success: false, error: 'Signal not found', durationMs: performance.now() - start }
    }

    chainResult = await runCausalPropagation(signal, exposureResult.data)
  }

  if (!chainResult.success || !chainResult.data) {
    return { success: false, error: chainResult.error ?? 'Causal chain generation failed', durationMs: performance.now() - start }
  }

  // Step 4: Temporal reasoning (fast, pure computation)
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
  causalChainCache.clear()
  clearSignalMonitorCache()
}
