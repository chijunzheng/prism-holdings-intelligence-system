import { DISCLAIMER } from '@prism/shared'
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
const exposureInFlight = new Map<string, Promise<AgentResult<ExposureMap>>>()
const signalInFlight = new Map<string, Promise<AgentResult<ReadonlyArray<Signal>>>>()
const chainInFlight = new Map<string, Promise<AgentResult<CausalChain>>>()

const SIGNAL_CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const EMPTY_SIGNAL_CACHE_TTL_MS = 60 * 1000 // 1 minute
const CHAIN_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_PREWARM_SIGNAL_LIMIT = 2

function getSignalCacheTtlMs(signalCount: number): number {
  return signalCount > 0 ? SIGNAL_CACHE_TTL_MS : EMPTY_SIGNAL_CACHE_TTL_MS
}

function getCachedExposure(portfolioId: string): ExposureMap | null {
  const entry = exposureCache.get(portfolioId)
  return entry?.data ?? null
}

function getCachedSignals(portfolioId: string): ReadonlyArray<Signal> | null {
  const entry = signalCache.get(portfolioId)
  if (!entry) return null
  const ttlMs = getSignalCacheTtlMs(entry.data.length)
  if (Date.now() - entry.cachedAt > ttlMs) {
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
  for (const [portfolioId, entry] of signalCache.entries()) {
    const ttlMs = getSignalCacheTtlMs(entry.data.length)
    if (Date.now() - entry.cachedAt > ttlMs) {
      signalCache.delete(portfolioId)
      continue
    }
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

interface SignalSectorMix {
  readonly category: string
  readonly categoryWeight: number
  readonly holdingWeightsByTicker: Readonly<Record<string, number>>
}

interface SignalHoldingMix {
  readonly holdingWeightsByTicker: Readonly<Record<string, number>>
  readonly sectors: ReadonlyArray<SignalSectorMix>
}

interface NetSignalSlice {
  readonly signal: Signal
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly holdingMix: SignalHoldingMix
  readonly recencyHours: number
  readonly baseScore: number
  readonly confidenceScore: number
  readonly weightedScore: number
}

export interface PortfolioNetSignalContribution {
  readonly signalId: string
  readonly headline: string
  readonly normalizedWeight: number
  readonly weightedScore: number
  readonly baseScore: number
  readonly confidenceScore: number
  readonly recencyHours: number
  readonly direction: 'positive' | 'negative' | 'ambiguous'
  readonly oneWeekImpactCad: number
  readonly oneMonthImpactCad: number
  readonly sixMonthImpactCad: number
}

export interface PortfolioNetImpactResult {
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly signalContributions: ReadonlyArray<PortfolioNetSignalContribution>
  readonly signalUniverseCount: number
  readonly includedSignalCount: number
  readonly thresholdScore: number
  readonly weightingModel: string
}

const SIGNAL_URGENCY_WEIGHT: Record<Signal['urgency'], number> = {
  low: 0.7,
  medium: 1,
  high: 1.35,
  critical: 1.75,
}

const SIGNAL_RECENCY_HALFLIFE_HOURS = 48
const PORTFOLIO_NET_SIGNAL_THRESHOLD = 0.2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeLabelKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function buildHoldingValueMap(portfolio: Portfolio): ReadonlyMap<string, number> {
  const map = new Map<string, number>()
  for (const account of portfolio.accounts) {
    for (const holding of account.holdings) {
      const key = holding.ticker.trim().toUpperCase()
      map.set(key, (map.get(key) ?? 0) + holding.valueCad)
    }
  }
  return map
}

function buildHoldingNameMap(portfolio: Portfolio): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  for (const account of portfolio.accounts) {
    for (const holding of account.holdings) {
      const key = holding.ticker.trim().toUpperCase()
      if (!map.has(key)) map.set(key, holding.name)
    }
  }
  return map
}

function buildHoldingWeightMap(portfolio: Portfolio): Readonly<Record<string, number>> {
  const values = buildHoldingValueMap(portfolio)
  const total = Math.max(portfolio.totalValueCad, 1)
  const entries = Array.from(values.entries()).map(([ticker, valueCad]) => [ticker, valueCad / total])
  return Object.fromEntries(entries)
}

function normalizeWeightMap(
  weights: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const entries = Object.entries(weights).filter(([, value]) => value > 0)
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  if (total <= 0) return {}
  return Object.fromEntries(entries.map(([ticker, value]) => [ticker, value / total]))
}

function recencyHours(detectedAt: string): number {
  const detectedMs = Date.parse(detectedAt)
  if (Number.isNaN(detectedMs)) return SIGNAL_RECENCY_HALFLIFE_HOURS * 2
  return Math.max(0, (Date.now() - detectedMs) / 3_600_000)
}

function signalBaseScore(signal: Signal): { readonly score: number; readonly ageHours: number } {
  const ageHours = recencyHours(signal.detectedAt)
  const recencyDecay = Math.exp((-Math.LN2 * ageHours) / SIGNAL_RECENCY_HALFLIFE_HOURS)
  const score = signal.relevanceScore * SIGNAL_URGENCY_WEIGHT[signal.urgency] * recencyDecay
  return { score, ageHours }
}

function buildExposureLookup(exposureMap: ExposureMap): ReadonlyMap<string, ExposureMap['exposures'][number]> {
  const lookup = new Map<string, ExposureMap['exposures'][number]>()
  for (const exposure of exposureMap.exposures) {
    lookup.set(normalizeLabelKey(exposure.category), exposure)
  }
  return lookup
}

function buildSignalHoldingMix(
  signal: Signal,
  exposureLookup: ReadonlyMap<string, ExposureMap['exposures'][number]>,
  fallbackHoldingWeights: Readonly<Record<string, number>>,
): SignalHoldingMix {
  const sectors: SignalSectorMix[] = []

  for (const exposureLabel of signal.affectedExposures) {
    const exposure = exposureLookup.get(normalizeLabelKey(exposureLabel))
    if (!exposure) continue

    const holdingWeightsRaw = Object.fromEntries(
      exposure.contributingHoldings.map((holding) => [
        holding.ticker.trim().toUpperCase(),
        Math.max(holding.contribution, 0),
      ]),
    )
    const normalizedHoldingWeights = normalizeWeightMap(holdingWeightsRaw)
    if (Object.keys(normalizedHoldingWeights).length === 0) continue

    sectors.push({
      category: exposure.category,
      categoryWeight: Math.max(exposure.percentage / 100, 0.01),
      holdingWeightsByTicker: normalizedHoldingWeights,
    })
  }

  if (sectors.length === 0) {
    return {
      holdingWeightsByTicker: fallbackHoldingWeights,
      sectors: [
        {
          category: 'Portfolio Holdings',
          categoryWeight: 1,
          holdingWeightsByTicker: fallbackHoldingWeights,
        },
      ],
    }
  }

  const sectorWeightTotal = sectors.reduce((sum, sector) => sum + sector.categoryWeight, 0)
  const normalizedSectors = sectors.map((sector) => ({
    ...sector,
    categoryWeight: sector.categoryWeight / Math.max(sectorWeightTotal, 1e-9),
  }))

  const holdingWeights: Record<string, number> = {}
  for (const sector of normalizedSectors) {
    for (const [ticker, weight] of Object.entries(sector.holdingWeightsByTicker)) {
      holdingWeights[ticker] = (holdingWeights[ticker] ?? 0) + weight * sector.categoryWeight
    }
  }

  return {
    holdingWeightsByTicker: normalizeWeightMap(holdingWeights),
    sectors: normalizedSectors,
  }
}

function edgeDirectionFromImpact(value: number): 'positive' | 'negative' | 'ambiguous' {
  if (value > 0.01) return 'positive'
  if (value < -0.01) return 'negative'
  return 'ambiguous'
}

function trimLabel(value: string, maxLength = 56): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

// ── Pipeline Steps ───────────────────────────────────

export async function runExposureAnalysis(
  ctx: PipelineContext,
): Promise<AgentResult<ExposureMap>> {
  const portfolioId = ctx.portfolio.userId
  const cached = getCachedExposure(portfolioId)
  if (cached) {
    return { success: true, data: cached, durationMs: 0 }
  }

  const existing = exposureInFlight.get(portfolioId)
  if (existing) return existing

  const task = analyze(ctx.portfolio, ctx.getFundComposition)
    .then((result) => {
      if (result.success && result.data) {
        exposureCache.set(portfolioId, { data: result.data, cachedAt: Date.now() })
      }
      return result
    })
    .finally(() => {
      exposureInFlight.delete(portfolioId)
    })

  exposureInFlight.set(portfolioId, task)
  return task
}

export async function runSignalMonitor(
  exposureMap: ExposureMap,
): Promise<AgentResult<ReadonlyArray<Signal>>> {
  const portfolioId = exposureMap.portfolioId
  const cached = getCachedSignals(portfolioId)
  if (cached) {
    return { success: true, data: cached, durationMs: 0 }
  }

  const existing = signalInFlight.get(portfolioId)
  if (existing) return existing

  const task = monitor(exposureMap)
    .then((result) => {
      if (result.success && result.data) {
        signalCache.set(portfolioId, { data: result.data, cachedAt: Date.now() })
      }
      return result
    })
    .finally(() => {
      signalInFlight.delete(portfolioId)
    })

  signalInFlight.set(portfolioId, task)
  return task
}

/**
 * Best-effort background prewarm for top signal chains.
 * Keeps graph navigation snappy after signals are loaded.
 */
export async function prewarmCausalChains(
  exposureMap: ExposureMap,
  signals: ReadonlyArray<Signal>,
  limit = DEFAULT_PREWARM_SIGNAL_LIMIT,
): Promise<void> {
  const candidates = signals.slice(0, Math.max(0, limit))
  if (candidates.length === 0) return

  await Promise.allSettled(
    candidates.map(async (signal) => {
      const cached = getCachedChain(signal.id)
      if (cached) return
      await runCausalPropagation(signal, exposureMap)
    }),
  )
}

export async function runCausalPropagation(
  signal: Signal,
  exposureMap: ExposureMap,
): Promise<AgentResult<CausalChain>> {
  const cached = getCachedChain(signal.id)
  if (cached) {
    return { success: true, data: cached, durationMs: 0 }
  }

  const existing = chainInFlight.get(signal.id)
  if (existing) return existing

  const task = propagate(signal, exposureMap)
    .then((result) => {
      if (result.success && result.data) {
        causalChainCache.set(signal.id, { data: result.data, cachedAt: Date.now() })
      }
      return result
    })
    .finally(() => {
      chainInFlight.delete(signal.id)
    })

  chainInFlight.set(signal.id, task)
  return task
}

export async function runTemporalReasoning(
  chain: CausalChain,
  profile: UserProfile,
  totalPortfolioValueCad?: number,
  holdingWeightsByTicker?: Readonly<Record<string, number>>,
): Promise<AgentResult<TemporalAnalysis>> {
  return classify(chain, profile, {
    totalPortfolioValueCad,
    holdingWeightsByTicker,
  })
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

    // Fire-and-forget prewarm for top signal chains to reduce next navigation latency.
    void prewarmCausalChains(exposureResult.data, signalResult.data)
    chainResult = await runCausalPropagation(signal, exposureResult.data)
  }

  if (!chainResult.success || !chainResult.data) {
    return { success: false, error: chainResult.error ?? 'Causal chain generation failed', durationMs: performance.now() - start }
  }

  // Step 4: Temporal reasoning (fast, pure computation)
  const holdingWeightsByTicker = buildHoldingWeightMap(ctx.portfolio)
  const temporalResult = await runTemporalReasoning(
    chainResult.data,
    ctx.profile,
    ctx.portfolio.totalValueCad,
    holdingWeightsByTicker,
  )
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

export async function runPortfolioNetImpactPipeline(
  ctx: PipelineContext,
): Promise<AgentResult<PortfolioNetImpactResult>> {
  const start = performance.now()

  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) {
    return {
      success: false,
      error: exposureResult.error ?? 'Exposure analysis failed',
      durationMs: performance.now() - start,
    }
  }
  const exposureMap = exposureResult.data

  const signalResult = await runSignalMonitor(exposureMap)
  if (!signalResult.success || !signalResult.data) {
    return {
      success: false,
      error: signalResult.error ?? 'Signal monitoring failed',
      durationMs: performance.now() - start,
    }
  }

  const universeSignals = signalResult.data
  if (universeSignals.length === 0) {
    return {
      success: false,
      error: 'No active signals available',
      durationMs: performance.now() - start,
    }
  }

  const holdingWeightsByTicker = buildHoldingWeightMap(ctx.portfolio)
  const holdingNameByTicker = buildHoldingNameMap(ctx.portfolio)
  const exposureLookup = buildExposureLookup(exposureMap)

  const signalSlices = await Promise.all(
    universeSignals.map(async (signal): Promise<NetSignalSlice | null> => {
      const chainResult = await runCausalPropagation(signal, exposureMap)
      if (!chainResult.success || !chainResult.data) return null

      const temporalResult = await runTemporalReasoning(
        chainResult.data,
        ctx.profile,
        ctx.portfolio.totalValueCad,
        holdingWeightsByTicker,
      )
      if (!temporalResult.success || !temporalResult.data) return null

      const base = signalBaseScore(signal)
      const confidenceScore = clamp(
        (temporalResult.data.confidence + temporalResult.data.timeBuckets.oneMonth.confidence) / 2,
        0.35,
        1,
      )

      return {
        signal,
        chain: chainResult.data,
        temporalAnalysis: temporalResult.data,
        holdingMix: buildSignalHoldingMix(signal, exposureLookup, holdingWeightsByTicker),
        recencyHours: base.ageHours,
        baseScore: base.score,
        confidenceScore,
        weightedScore: base.score * confidenceScore,
      }
    }),
  )

  const validSlices = signalSlices.filter((slice): slice is NetSignalSlice => Boolean(slice))
  if (validSlices.length === 0) {
    return {
      success: false,
      error: 'Unable to build net impact from active signals',
      durationMs: performance.now() - start,
    }
  }

  const included = validSlices
    .filter((slice) => slice.weightedScore >= PORTFOLIO_NET_SIGNAL_THRESHOLD)
    .sort((a, b) => b.weightedScore - a.weightedScore)

  if (included.length === 0) {
    included.push([...validSlices].sort((a, b) => b.weightedScore - a.weightedScore)[0])
  }

  const totalWeightedScore = included.reduce((sum, slice) => sum + slice.weightedScore, 0)
  const normalizedIncluded = included.map((slice) => ({
    ...slice,
    normalizedWeight: slice.weightedScore / Math.max(totalWeightedScore, 1e-9),
  }))

  const sectorNodeIdByCategory = new Map<string, string>()
  const mechanismNodeIdBySignal = new Map<string, string>()
  const assetNodeIdByTicker = new Map<string, string>()

  const sectorHoldingOneMonthImpact = new Map<string, Map<string, number>>()
  const sectorOneMonthImpact = new Map<string, number>()
  const holdingAggregate = new Map<
    string,
    {
      oneWeek: number
      oneMonth: number
      sixMonth: number
      confidenceWeightedNumerator: number
      confidenceWeightedDenominator: number
    }
  >()

  const signalContributions: PortfolioNetSignalContribution[] = []

  for (const slice of normalizedIncluded) {
    const { oneWeek, oneMonth, sixMonth } = slice.temporalAnalysis.timeBuckets
    const weightedOneWeek = oneWeek.expectedDollarImpact * slice.normalizedWeight
    const weightedOneMonth = oneMonth.expectedDollarImpact * slice.normalizedWeight
    const weightedSixMonth = sixMonth.expectedDollarImpact * slice.normalizedWeight

    signalContributions.push({
      signalId: slice.signal.id,
      headline: slice.signal.headline,
      normalizedWeight: slice.normalizedWeight,
      weightedScore: slice.weightedScore,
      baseScore: slice.baseScore,
      confidenceScore: slice.confidenceScore,
      recencyHours: slice.recencyHours,
      direction: oneMonth.direction,
      oneWeekImpactCad: weightedOneWeek,
      oneMonthImpactCad: weightedOneMonth,
      sixMonthImpactCad: weightedSixMonth,
    })

    for (const [ticker, weight] of Object.entries(slice.holdingMix.holdingWeightsByTicker)) {
      const existing = holdingAggregate.get(ticker) ?? {
        oneWeek: 0,
        oneMonth: 0,
        sixMonth: 0,
        confidenceWeightedNumerator: 0,
        confidenceWeightedDenominator: 0,
      }

      const oneWeekImpact = weightedOneWeek * weight
      const oneMonthImpact = weightedOneMonth * weight
      const sixMonthImpact = weightedSixMonth * weight

      existing.oneWeek += oneWeekImpact
      existing.oneMonth += oneMonthImpact
      existing.sixMonth += sixMonthImpact

      const confidenceWeight = Math.abs(oneMonthImpact)
      existing.confidenceWeightedNumerator += confidenceWeight * oneMonth.confidence
      existing.confidenceWeightedDenominator += confidenceWeight

      holdingAggregate.set(ticker, existing)
    }

    for (const sector of slice.holdingMix.sectors) {
      sectorOneMonthImpact.set(
        sector.category,
        (sectorOneMonthImpact.get(sector.category) ?? 0) +
          weightedOneMonth * sector.categoryWeight,
      )

      const sectorHoldings = sectorHoldingOneMonthImpact.get(sector.category) ?? new Map<string, number>()
      for (const [ticker, weight] of Object.entries(sector.holdingWeightsByTicker)) {
        sectorHoldings.set(
          ticker,
          (sectorHoldings.get(ticker) ?? 0) + weightedOneMonth * sector.categoryWeight * weight,
        )
      }
      sectorHoldingOneMonthImpact.set(sector.category, sectorHoldings)
    }
  }

  // Include all current holdings in total-impact mode so users can inspect
  // modeled impact across the entire portfolio, not only top movers.
  for (const ticker of holdingNameByTicker.keys()) {
    if (holdingAggregate.has(ticker)) continue
    holdingAggregate.set(ticker, {
      oneWeek: 0,
      oneMonth: 0,
      sixMonth: 0,
      confidenceWeightedNumerator: 0.55,
      confidenceWeightedDenominator: 1,
    })
  }

  const selectedHoldingEntries = Array.from(holdingAggregate.entries()).sort(
    (a, b) => Math.abs(b[1].oneMonth) - Math.abs(a[1].oneMonth),
  )

  const selectedHoldingTickers = new Set(selectedHoldingEntries.map(([ticker]) => ticker))

  const maxSignalAbsImpact = Math.max(
    ...normalizedIncluded.map((slice) => Math.abs(slice.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact)),
    1,
  )
  const maxSectorHoldingImpact = Math.max(
    ...Array.from(sectorHoldingOneMonthImpact.values()).flatMap((byTicker) =>
      Array.from(byTicker.values()).map((impact) => Math.abs(impact)),
    ),
    1,
  )

  const nodes: CausalChain['nodes'][number][] = []
  const edges: CausalChain['edges'][number][] = []

  const eventNodeId = 'net-event'
  nodes.push({
    id: eventNodeId,
    type: 'event',
    label: 'Total Impact Signal Regime',
    description: `Aggregated view across ${normalizedIncluded.length} active signal(s) above threshold.`,
    confidence: clamp(
      normalizedIncluded.reduce((sum, slice) => sum + slice.temporalAnalysis.confidence * slice.normalizedWeight, 0),
      0.45,
      0.95,
    ),
    metadata: {
      weightingModel: 'confidence+recency',
      thresholdScore: PORTFOLIO_NET_SIGNAL_THRESHOLD,
    },
  })

  normalizedIncluded.forEach((slice, index) => {
    const mechanismId = `net-mechanism-${index + 1}`
    mechanismNodeIdBySignal.set(slice.signal.id, mechanismId)

    nodes.push({
      id: mechanismId,
      type: 'mechanism',
      label: trimLabel(slice.signal.headline, 52),
      description: `${slice.signal.urgency.toUpperCase()} urgency, ${slice.signal.relevanceScore.toFixed(2)} relevance, detected ${Math.round(slice.recencyHours)}h ago.`,
      temporalClassification: slice.signal.temporalClassification,
      confidence: clamp(
        (slice.temporalAnalysis.confidence + slice.temporalAnalysis.timeBuckets.oneMonth.confidence) / 2,
        0.35,
        0.95,
      ),
      metadata: {
        signalId: slice.signal.id,
        normalizedWeight: slice.normalizedWeight,
      },
    })

    edges.push({
      id: `net-edge-event-${index + 1}`,
      source: eventNodeId,
      target: mechanismId,
      magnitude: clamp(
        Math.abs(slice.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact) / maxSignalAbsImpact,
        0.15,
        1,
      ),
      direction: slice.temporalAnalysis.timeBuckets.oneMonth.direction,
      confidence: clamp(slice.temporalAnalysis.timeBuckets.oneMonth.confidence, 0.35, 0.95),
      mechanism: `Weighted contribution ${Math.round(slice.normalizedWeight * 100)}% to the portfolio net impact.`,
    })
  })

  Array.from(sectorOneMonthImpact.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([category], index) => {
      const sectorId = `net-sector-${index + 1}`
      sectorNodeIdByCategory.set(category, sectorId)
      nodes.push({
        id: sectorId,
        type: 'sector',
        label: category,
        description: `Aggregate transmission channel from active signals into ${category}.`,
        confidence: 0.7,
        metadata: {},
      })
    })

  selectedHoldingEntries.forEach(([ticker, impact], index) => {
    const assetId = `net-asset-${index + 1}`
    assetNodeIdByTicker.set(ticker, assetId)

    const relatedConstituents = exposureMap.overlaps
      .filter((overlap) =>
        overlap.sources.some((source) => source.fundTicker.trim().toUpperCase() === ticker),
      )
      .slice(0, 5)
      .map((overlap) => overlap.assetTicker || overlap.assetName)

    nodes.push({
      id: assetId,
      type: 'asset',
      label: ticker,
      description: `${holdingNameByTicker.get(ticker) ?? ticker} (tradeable holding).`,
      confidence: clamp(
        impact.confidenceWeightedNumerator / Math.max(impact.confidenceWeightedDenominator, 0.2),
        0.35,
        0.95,
      ),
      dollarImpact: impact.oneMonth,
      metadata: {
        ticker,
        holdingName: holdingNameByTicker.get(ticker) ?? ticker,
        lookThroughConstituents: relatedConstituents,
      },
    })
  })

  let mechanismSectorEdgeCount = 0
  normalizedIncluded.forEach((slice) => {
    const mechanismId = mechanismNodeIdBySignal.get(slice.signal.id)
    if (!mechanismId) return
    slice.holdingMix.sectors.forEach((sector) => {
      const sectorId = sectorNodeIdByCategory.get(sector.category)
      if (!sectorId) return
      mechanismSectorEdgeCount += 1
      edges.push({
        id: `net-edge-mech-sector-${mechanismSectorEdgeCount}`,
        source: mechanismId,
        target: sectorId,
        magnitude: clamp(sector.categoryWeight, 0.1, 1),
        direction: slice.temporalAnalysis.timeBuckets.oneMonth.direction,
        confidence: clamp(slice.temporalAnalysis.timeBuckets.oneMonth.confidence, 0.35, 0.95),
        mechanism: `Signal pathway through ${sector.category}.`,
      })
    })
  })

  let sectorAssetEdgeCount = 0
  sectorHoldingOneMonthImpact.forEach((byTicker, category) => {
    const sectorId = sectorNodeIdByCategory.get(category)
    if (!sectorId) return
    byTicker.forEach((impact, ticker) => {
      if (!selectedHoldingTickers.has(ticker)) return
      const assetId = assetNodeIdByTicker.get(ticker)
      if (!assetId) return
      sectorAssetEdgeCount += 1
      edges.push({
        id: `net-edge-sector-asset-${sectorAssetEdgeCount}`,
        source: sectorId,
        target: assetId,
        magnitude: clamp(Math.abs(impact) / maxSectorHoldingImpact, 0.1, 1),
        direction: edgeDirectionFromImpact(impact),
        confidence: 0.68,
        mechanism: `${category} transmission into ${ticker}.`,
      })
    })
  })

  const topNegative = selectedHoldingEntries
    .filter(([, impact]) => impact.oneMonth < 0)
    .sort((a, b) => a[1].oneMonth - b[1].oneMonth)[0]
  const topPositive = selectedHoldingEntries
    .filter(([, impact]) => impact.oneMonth > 0)
    .sort((a, b) => b[1].oneMonth - a[1].oneMonth)[0]

  const summaryParts: string[] = []
  if (topNegative) {
    summaryParts.push(
      `Largest modeled downside is ${topNegative[0]} (${Math.round(topNegative[1].oneMonth)} CAD over 1 month).`,
    )
  }
  if (topPositive) {
    summaryParts.push(
      `Largest modeled upside is ${topPositive[0]} (+${Math.round(topPositive[1].oneMonth)} CAD over 1 month).`,
    )
  }
  summaryParts.push(
    `Net view combines ${normalizedIncluded.length} signals with confidence+recency weighting.`,
  )

  const netChain: CausalChain = {
    id: `net-${ctx.portfolio.userId}-${Date.now()}`,
    signalId: 'portfolio-net',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    summary: summaryParts.join(' '),
    disclaimer: DISCLAIMER,
    maxHops: 3,
    isSpeculative: false,
  }

  const temporalResult = await runTemporalReasoning(
    netChain,
    ctx.profile,
    ctx.portfolio.totalValueCad,
    holdingWeightsByTicker,
  )
  if (!temporalResult.success || !temporalResult.data) {
    return {
      success: false,
      error: temporalResult.error ?? 'Temporal reasoning failed for portfolio net impact',
      durationMs: performance.now() - start,
    }
  }

  return {
    success: true,
    data: {
      chain: netChain,
      temporalAnalysis: temporalResult.data,
      signalContributions: signalContributions.sort((a, b) => b.normalizedWeight - a.normalizedWeight),
      signalUniverseCount: universeSignals.length,
      includedSignalCount: normalizedIncluded.length,
      thresholdScore: PORTFOLIO_NET_SIGNAL_THRESHOLD,
      weightingModel: 'confidence+recency',
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
  exposureInFlight.clear()
  signalInFlight.clear()
  chainInFlight.clear()
  clearSignalMonitorCache()
}
