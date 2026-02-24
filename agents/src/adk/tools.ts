import { FunctionTool } from '@google/adk'
import { Type, type Schema } from '@google/genai'
import { z } from 'zod'
import { getFundComposition, getPortfolioByUserId, getUserProfileById } from '@prism/data'
import type { CausalChain, ExposureMap, Signal } from '@prism/shared'
import { analyze } from '../exposure-analyzer'
import { monitor } from '../signal-monitor'
import { propagate } from '../causal-propagation'
import { classify, type TemporalAnalysis } from '../temporal-reasoner'
import { compose, type AlertOutput } from '../alert-composer'

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

export async function buildSignalGraphContext(input: {
  userId: string
  signalId?: string
}): Promise<SignalGraphToolResult> {
  const userId = input.userId.trim()
  const signalId = input.signalId?.trim()

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) return toError(`Portfolio not found for user ${userId}`)

  const profile = getUserProfileById(userId)
  if (!profile) return toError(`User profile not found for user ${userId}`)

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    return toError(exposureResult.error ?? 'Exposure analysis failed')
  }

  const signalResult = await monitor(exposureResult.data)
  if (!signalResult.success || !signalResult.data) {
    return toError(signalResult.error ?? 'Signal monitoring failed')
  }

  const selectedSignal = signalId
    ? signalResult.data.find((signal) => signal.id === signalId)
    : signalResult.data[0]

  if (!selectedSignal) {
    const suffix = signalId ? `: ${signalId}` : ''
    return toError(`No active signal available${suffix}`)
  }

  const chainResult = await propagate(selectedSignal, exposureResult.data)
  if (!chainResult.success || !chainResult.data) {
    return toError(chainResult.error ?? 'Causal propagation failed')
  }

  const temporalResult = await classify(chainResult.data, profile)
  if (!temporalResult.success || !temporalResult.data) {
    return toError(temporalResult.error ?? 'Temporal reasoning failed')
  }

  const totalPortfolioValueCad = exposureResult.data.exposures.reduce(
    (sum, entry) => sum + entry.valueCad,
    0,
  )

  const alertResult = await compose(chainResult.data, profile, {
    temporalAnalysis: temporalResult.data,
    totalPortfolioValueCad,
  })

  return {
    ok: true,
    userId,
    selectedSignal: summarizeSignal(selectedSignal),
    exposureSummary: topExposureSummary(exposureResult.data),
    chain: chainResult.data,
    temporalAnalysis: temporalResult.data,
    alertPreview: alertResult.success ? alertResult.data ?? null : null,
  }
}

export async function listActiveSignals(input: { userId: string }): Promise<SignalListToolResult> {
  const userId = input.userId.trim()

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) return toError(`Portfolio not found for user ${userId}`)

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    return toError(exposureResult.error ?? 'Exposure analysis failed')
  }

  const signalResult = await monitor(exposureResult.data)
  if (!signalResult.success || !signalResult.data) {
    return toError(signalResult.error ?? 'Signal monitoring failed')
  }

  return {
    ok: true,
    userId,
    signals: signalResult.data.map(summarizeSignal),
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

export const prismPipelineTools = [listActiveSignalsTool, buildSignalGraphContextTool]
