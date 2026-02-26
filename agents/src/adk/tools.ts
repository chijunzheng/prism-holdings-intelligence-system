import { FunctionTool } from '@google/adk'
import { Type, type Schema } from '@google/genai'
import { z } from 'zod'
import { getFundComposition, getPortfolioByUserId, getUserProfileById } from '@prism/data'
import type { CausalChain, ExposureMap, Signal } from '@prism/shared'
import { compose, type AlertOutput } from '../alert-composer'
import {
  prewarmCausalChains,
  runExposureAnalysis,
  runGraphPipeline,
  runSignalMonitor,
  type PipelineContext,
} from '../orchestrator'
import type { TemporalAnalysis } from '../temporal-reasoner'

interface ToolErrorResult {
  readonly ok: false
  readonly error: string
}

interface SignalSummary {
  readonly id: string
  readonly headline: string
  readonly urgency: Signal['urgency']
  readonly relevanceScore: number
  readonly temporalClassification: Signal['temporalClassification']
  readonly detectedAt: string
}

interface SignalGraphContext {
  readonly ok: true
  readonly userId: string
  readonly selectedSignal: SignalSummary
  readonly exposureSummary: ReadonlyArray<{
    readonly category: string
    readonly percentage: number
    readonly valueCad: number
  }>
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly alertPreview: AlertOutput | null
}

type SignalGraphToolResult = SignalGraphContext | ToolErrorResult

interface SignalListContext {
  readonly ok: true
  readonly userId: string
  readonly signals: ReadonlyArray<SignalSummary>
}

type SignalListToolResult = SignalListContext | ToolErrorResult

interface SignalListDetailedContext {
  readonly ok: true
  readonly userId: string
  readonly signals: ReadonlyArray<Signal>
}

type SignalListDetailedToolResult = SignalListDetailedContext | ToolErrorResult

interface SignalGraphPipelineContext {
  readonly ok: true
  readonly userId: string
  readonly signal: Signal
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
}

type SignalGraphPipelineToolResult = SignalGraphPipelineContext | ToolErrorResult

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const TRACE_ADK_TOOLS =
  isTruthyEnv(process.env.DEBUG_IMPACT_TRACE) || isTruthyEnv(process.env.PRISM_TRACE)

function traceAdkTool(scope: string, payload: Record<string, unknown>): void {
  if (!TRACE_ADK_TOOLS) return
  // eslint-disable-next-line no-console
  console.log(`[PrismTrace][adk-tool:${scope}]`, payload)
}

const buildSignalGraphContextParams = z.object({
  userId: z.string().min(1).describe('Portfolio owner id, e.g. sarah-01'),
  signalId: z
    .string()
    .min(1)
    .optional()
    .describe('Optional signal id to inspect. Defaults to highest-priority active signal.'),
})

const listSignalsParams = z.object({
  userId: z.string().min(1).describe('Portfolio owner id, e.g. sarah-01'),
})

const buildSignalGraphPipelineParams = z.object({
  userId: z.string().min(1).describe('Portfolio owner id, e.g. sarah-01'),
  signalId: z
    .string()
    .min(1)
    .optional()
    .describe('Optional signal id to inspect. Defaults to highest-priority active signal.'),
})

const listSignalsToolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    userId: {
      type: Type.STRING,
      description: 'Portfolio owner id, e.g. sarah-01',
    },
  },
  required: ['userId'],
}

const listSignalsDetailedToolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    userId: {
      type: Type.STRING,
      description: 'Portfolio owner id, e.g. sarah-01',
    },
  },
  required: ['userId'],
}

const buildSignalGraphPipelineToolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    userId: {
      type: Type.STRING,
      description: 'Portfolio owner id, e.g. sarah-01',
    },
    signalId: {
      type: Type.STRING,
      description:
        'Optional signal id to inspect. Defaults to highest-priority active signal.',
    },
  },
  required: ['userId'],
}

const buildSignalGraphContextToolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    userId: {
      type: Type.STRING,
      description: 'Portfolio owner id, e.g. sarah-01',
    },
    signalId: {
      type: Type.STRING,
      description:
        'Optional signal id to inspect. Defaults to highest-priority active signal.',
    },
  },
  required: ['userId'],
}

function summarizeSignal(signal: Signal): SignalSummary {
  return {
    id: signal.id,
    headline: signal.headline,
    urgency: signal.urgency,
    relevanceScore: signal.relevanceScore,
    temporalClassification: signal.temporalClassification,
    detectedAt: signal.detectedAt,
  }
}

function topExposureSummary(exposureMap: ExposureMap): ReadonlyArray<{
  readonly category: string
  readonly percentage: number
  readonly valueCad: number
}> {
  return [...exposureMap.exposures]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8)
    .map((entry) => ({
      category: entry.category,
      percentage: entry.percentage,
      valueCad: entry.valueCad,
    }))
}

function toError(message: string): ToolErrorResult {
  return { ok: false, error: message }
}

function buildPipelineContext(userId: string): PipelineContext | ToolErrorResult {
  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) return toError(`Portfolio not found for user ${userId}`)

  const profile = getUserProfileById(userId)
  if (!profile) return toError(`User profile not found for user ${userId}`)

  return { portfolio, profile, getFundComposition }
}

async function resolveExposureAndSignals(
  userId: string,
): Promise<
  | {
      readonly ok: true
      readonly ctx: PipelineContext
      readonly exposureMap: ExposureMap
      readonly signals: ReadonlyArray<Signal>
    }
  | ToolErrorResult
> {
  const startedAt = performance.now()
  traceAdkTool('resolve:start', { userId })
  const ctxOrError = buildPipelineContext(userId)
  if ('ok' in ctxOrError && ctxOrError.ok === false) {
    traceAdkTool('resolve:error', {
      userId,
      stage: 'context',
      error: ctxOrError.error,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return ctxOrError
  }
  const ctx = ctxOrError as PipelineContext

  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) {
    traceAdkTool('resolve:error', {
      userId,
      stage: 'exposure',
      error: exposureResult.error ?? 'Exposure analysis failed',
      durationMs: Math.round(performance.now() - startedAt),
    })
    return toError(exposureResult.error ?? 'Exposure analysis failed')
  }
  traceAdkTool('resolve:exposure', {
    userId,
    exposureCount: exposureResult.data.exposures.length,
    durationMs: Math.round(exposureResult.durationMs),
  })

  const signalResult = await runSignalMonitor(exposureResult.data)
  if (!signalResult.success || !signalResult.data) {
    traceAdkTool('resolve:error', {
      userId,
      stage: 'signals',
      error: signalResult.error ?? 'Signal monitoring failed',
      durationMs: Math.round(performance.now() - startedAt),
    })
    return toError(signalResult.error ?? 'Signal monitoring failed')
  }
  traceAdkTool('resolve:signals', {
    userId,
    signalCount: signalResult.data.length,
    durationMs: Math.round(signalResult.durationMs),
  })

  void prewarmCausalChains(exposureResult.data, signalResult.data)

  traceAdkTool('resolve:success', {
    userId,
    signalCount: signalResult.data.length,
    exposureCount: exposureResult.data.exposures.length,
    totalDurationMs: Math.round(performance.now() - startedAt),
  })

  return {
    ok: true,
    ctx,
    exposureMap: exposureResult.data,
    signals: signalResult.data,
  }
}

export async function buildSignalGraphContext(input: {
  userId: string
  signalId?: string
}): Promise<SignalGraphToolResult> {
  const userId = input.userId.trim()
  const signalId = input.signalId?.trim()
  const base = await resolveExposureAndSignals(userId)
  if (!base.ok) return base

  const selectedSignal = signalId
    ? base.signals.find((signal) => signal.id === signalId)
    : base.signals[0]

  if (!selectedSignal) {
    const suffix = signalId ? `: ${signalId}` : ''
    return toError(`No active signal available${suffix}`)
  }

  const graphResult = await runGraphPipeline(base.ctx, selectedSignal.id)
  if (!graphResult.success || !graphResult.data) {
    return toError(graphResult.error ?? 'Graph pipeline failed')
  }

  const totalPortfolioValueCad = base.exposureMap.exposures.reduce(
    (sum, entry) => sum + entry.valueCad,
    0,
  )

  const alertResult = await compose(graphResult.data.chain, base.ctx.profile, {
    temporalAnalysis: graphResult.data.temporalAnalysis,
    totalPortfolioValueCad,
  })

  return {
    ok: true,
    userId,
    selectedSignal: summarizeSignal(selectedSignal),
    exposureSummary: topExposureSummary(base.exposureMap),
    chain: graphResult.data.chain,
    temporalAnalysis: graphResult.data.temporalAnalysis,
    alertPreview: alertResult.success ? alertResult.data ?? null : null,
  }
}

export async function listActiveSignals(input: { userId: string }): Promise<SignalListToolResult> {
  const userId = input.userId.trim()
  const base = await resolveExposureAndSignals(userId)
  if (!base.ok) return base

  return {
    ok: true,
    userId,
    signals: base.signals.map(summarizeSignal),
  }
}

export async function listActiveSignalsDetailed(input: {
  userId: string
}): Promise<SignalListDetailedToolResult> {
  const userId = input.userId.trim()
  const base = await resolveExposureAndSignals(userId)
  if (!base.ok) return base

  return {
    ok: true,
    userId,
    signals: base.signals,
  }
}

export async function buildSignalGraphPipeline(input: {
  userId: string
  signalId?: string
}): Promise<SignalGraphPipelineToolResult> {
  const userId = input.userId.trim()
  const signalId = input.signalId?.trim()

  const base = await resolveExposureAndSignals(userId)
  if (!base.ok) return base

  const selectedSignal = signalId
    ? base.signals.find((signal) => signal.id === signalId)
    : base.signals[0]

  if (!selectedSignal) {
    const suffix = signalId ? `: ${signalId}` : ''
    return toError(`No active signal available${suffix}`)
  }

  const graphResult = await runGraphPipeline(base.ctx, selectedSignal.id)
  if (!graphResult.success || !graphResult.data) {
    return toError(graphResult.error ?? 'Graph pipeline failed')
  }

  return {
    ok: true,
    userId,
    signal: graphResult.data.signal,
    chain: graphResult.data.chain,
    temporalAnalysis: graphResult.data.temporalAnalysis,
  }
}

export const listActiveSignalsTool = new FunctionTool({
  name: 'list_active_signals',
  description:
    'Fetch active market signals that are relevant to a specific user portfolio and exposure profile.',
  parameters: listSignalsToolSchema,
  execute: async (input) => {
    const parsed = listSignalsParams.safeParse(input)
    if (!parsed.success) return toError('Invalid input for list_active_signals')
    return listActiveSignals(parsed.data)
  },
})

export const buildSignalGraphContextTool = new FunctionTool({
  name: 'build_signal_graph_context',
  description:
    'Run the full Prism analysis pipeline for one signal: exposure analysis, signal monitoring, causal chain, temporal reasoning, and alert preview.',
  parameters: buildSignalGraphContextToolSchema,
  execute: async (input) => {
    const parsed = buildSignalGraphContextParams.safeParse(input)
    if (!parsed.success) return toError('Invalid input for build_signal_graph_context')
    return buildSignalGraphContext(parsed.data)
  },
})

export const listActiveSignalsDetailedTool = new FunctionTool({
  name: 'list_active_signals_detailed',
  description:
    'Fetch full active market signal payloads for a specific user portfolio and exposure profile.',
  parameters: listSignalsDetailedToolSchema,
  execute: async (input) => {
    const parsed = listSignalsParams.safeParse(input)
    if (!parsed.success) return toError('Invalid input for list_active_signals_detailed')
    return listActiveSignalsDetailed(parsed.data)
  },
})

export const buildSignalGraphPipelineTool = new FunctionTool({
  name: 'build_signal_graph_pipeline',
  description:
    'Run full Prism graph pipeline and return complete signal + chain + temporal analysis payload.',
  parameters: buildSignalGraphPipelineToolSchema,
  execute: async (input) => {
    const parsed = buildSignalGraphPipelineParams.safeParse(input)
    if (!parsed.success) return toError('Invalid input for build_signal_graph_pipeline')
    return buildSignalGraphPipeline(parsed.data)
  },
})

export const prismPipelineTools = [listActiveSignalsTool, buildSignalGraphContextTool]
export const prismEndpointPipelineTools = [
  listActiveSignalsDetailedTool,
  buildSignalGraphPipelineTool,
]
