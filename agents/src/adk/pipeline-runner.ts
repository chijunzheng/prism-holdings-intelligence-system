import { InMemoryRunner, LlmAgent, isFinalResponse, stringifyContent } from '@google/adk'
import { createUserContent } from '@google/genai'
import { CausalChainSchema, SignalSchema, type CausalChain, type Signal } from '@prism/shared'
import type { AgentResult } from '../types'
import type { TemporalAnalysis } from '../temporal-reasoner'
import { getGeminiFastModelName } from '../utils/env'
import { ensureAdkEnvironment, hasAdkApiKey } from './env'
import {
  buildSignalGraphPipelineTool,
  listActiveSignalsDetailedTool,
} from './tools'

interface ToolErrorResult {
  readonly ok: false
  readonly error: string
}

interface SignalListDetailedContext {
  readonly ok: true
  readonly userId: string
  readonly signals: ReadonlyArray<Signal>
}

interface SignalGraphPipelineContext {
  readonly ok: true
  readonly userId: string
  readonly signal: Signal
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
}

const SIGNALS_STATE_KEY = 'app:adk_signals_result'
const GRAPH_STATE_KEY = 'app:adk_graph_result'
const SIGNALS_APP_NAME = 'prism_adk_signals_endpoint'
const GRAPH_APP_NAME = 'prism_adk_graph_endpoint'
const SIGNALS_MODEL = getGeminiFastModelName()
const GRAPH_MODEL = getGeminiFastModelName()

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const TRACE_ADK =
  isTruthyEnv(process.env.DEBUG_IMPACT_TRACE) || isTruthyEnv(process.env.PRISM_TRACE)
const TRACE_ADK_VERBOSE = TRACE_ADK || isTruthyEnv(process.env.PRISM_TRACE_LLM)

function traceAdk(scope: string, payload: Record<string, unknown>): void {
  if (!TRACE_ADK) return
  // eslint-disable-next-line no-console
  console.log(`[PrismTrace][adk:${scope}]`, payload)
}

function traceAdkVerbose(scope: string, payload: Record<string, unknown>): void {
  if (!TRACE_ADK_VERBOSE) return
  // eslint-disable-next-line no-console
  console.log(`[PrismTrace][adk:${scope}]`, payload)
}

function compactTextSnippet(value: string, maxLength = 260): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1)}…`
}

const SIGNALS_AGENT_INSTRUCTION = `
You are a deterministic backend orchestration agent.

Input format:
- The user message is strict JSON: {"userId":"..."}.

Rules:
1. Parse the JSON.
2. Call list_active_signals_detailed exactly once using that userId.
3. Do not call any other tools.
4. After the tool call, reply with a one-line acknowledgement only.
`.trim()

const GRAPH_AGENT_INSTRUCTION = `
You are a deterministic backend orchestration agent.

Input format:
- The user message is strict JSON: {"userId":"...","signalId":"..."}.
- signalId may be omitted.

Rules:
1. Parse the JSON.
2. Call build_signal_graph_pipeline exactly once with the same fields.
3. Do not call any other tools.
4. After the tool call, reply with a one-line acknowledgement only.
`.trim()

const signalsEndpointAgent = new LlmAgent({
  name: 'prism_adk_signals_endpoint_agent',
  description: 'ADK endpoint orchestrator for active signal retrieval',
  model: SIGNALS_MODEL,
  instruction: SIGNALS_AGENT_INSTRUCTION,
  tools: [listActiveSignalsDetailedTool],
  includeContents: 'none',
  disallowTransferToParent: true,
  disallowTransferToPeers: true,
  generateContentConfig: { temperature: 0 },
  afterToolCallback: ({ context, response }) => {
    context.state.set(SIGNALS_STATE_KEY, response)
    return undefined
  },
})

const graphEndpointAgent = new LlmAgent({
  name: 'prism_adk_graph_endpoint_agent',
  description: 'ADK endpoint orchestrator for graph pipeline payload retrieval',
  model: GRAPH_MODEL,
  instruction: GRAPH_AGENT_INSTRUCTION,
  tools: [buildSignalGraphPipelineTool],
  includeContents: 'none',
  disallowTransferToParent: true,
  disallowTransferToPeers: true,
  generateContentConfig: { temperature: 0 },
  afterToolCallback: ({ context, response }) => {
    context.state.set(GRAPH_STATE_KEY, response)
    return undefined
  },
})

const signalsRunner = new InMemoryRunner({
  appName: SIGNALS_APP_NAME,
  agent: signalsEndpointAgent,
})

const graphRunner = new InMemoryRunner({
  appName: GRAPH_APP_NAME,
  agent: graphEndpointAgent,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isToolErrorResult(value: unknown): value is ToolErrorResult {
  return isRecord(value) && value.ok === false && typeof value.error === 'string'
}

function isSignalListDetailedContext(value: unknown): value is SignalListDetailedContext {
  if (!isRecord(value)) return false
  if (value.ok !== true) return false
  if (typeof value.userId !== 'string') return false
  if (!Array.isArray(value.signals)) return false
  return SignalSchema.array().safeParse(value.signals).success
}

function isTemporalAnalysis(value: unknown): value is TemporalAnalysis {
  if (!isRecord(value)) return false
  if (!isRecord(value.timeBuckets)) return false
  if (!Array.isArray(value.recommendations)) return false
  return (
    typeof value.classification === 'string' &&
    typeof value.confidence === 'number' &&
    isRecord(value.methodology) &&
    Array.isArray(value.impactClassifications)
  )
}

function isSignalGraphPipelineContext(value: unknown): value is SignalGraphPipelineContext {
  if (!isRecord(value)) return false
  if (value.ok !== true) return false
  if (typeof value.userId !== 'string') return false
  if (!SignalSchema.safeParse(value.signal).success) return false
  if (!CausalChainSchema.safeParse(value.chain).success) return false
  if (!isTemporalAnalysis(value.temporalAnalysis)) return false
  return true
}

function extractFirstJsonBlock(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    // Continue.
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!objectMatch) return null

  try {
    return JSON.parse(objectMatch[0])
  } catch {
    return null
  }
}

interface AdkToolRunDiagnostics {
  readonly sessionId: string
  readonly eventCount: number
  readonly finalResponseCount: number
  readonly toolCallPartCount: number
  readonly toolResponsePartCount: number
  readonly textPartCount: number
  readonly fallbackTextChars: number
}

function describeCandidate(value: unknown): string {
  if (value === null || value === undefined) return String(value)
  if (Array.isArray(value)) return `array(${value.length})`
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    return `object(${keys.slice(0, 8).join(',')})`
  }
  return typeof value
}

async function runAdkToolCall(params: {
  readonly runner: InMemoryRunner
  readonly appName: string
  readonly userId: string
  readonly stateKey: string
  readonly payload: Record<string, string>
}): Promise<{
  readonly stateValue: unknown
  readonly fallbackText: string
  readonly diagnostics: AdkToolRunDiagnostics
}> {
  const session = await params.runner.sessionService.createSession({
    appName: params.appName,
    userId: params.userId,
  })

  let fallbackText = ''
  let eventCount = 0
  let finalResponseCount = 0
  let toolCallPartCount = 0
  let toolResponsePartCount = 0
  let textPartCount = 0

  for await (const event of params.runner.runAsync({
    userId: params.userId,
    sessionId: session.id,
    newMessage: createUserContent(JSON.stringify(params.payload)),
  })) {
    eventCount += 1
    const content = (event as { readonly content?: { readonly parts?: ReadonlyArray<Record<string, unknown>> } })
      .content
    const parts = content?.parts ?? []
    for (const part of parts) {
      if ('functionCall' in part || 'function_call' in part) toolCallPartCount += 1
      if ('functionResponse' in part || 'function_response' in part) toolResponsePartCount += 1
      if ('text' in part) textPartCount += 1
    }

    traceAdkVerbose(`${params.appName}:event`, {
      sessionId: session.id,
      index: eventCount,
      final: isFinalResponse(event),
      partCount: parts.length,
      textPartCount,
      toolCallPartCount,
      toolResponsePartCount,
    })

    if (isFinalResponse(event)) {
      finalResponseCount += 1
      const text = stringifyContent(event).trim()
      if (text) fallbackText = text
    }
  }

  const hydrated = await params.runner.sessionService.getSession({
    appName: params.appName,
    userId: params.userId,
    sessionId: session.id,
  })

  return {
    stateValue: hydrated?.state?.[params.stateKey],
    fallbackText,
    diagnostics: {
      sessionId: session.id,
      eventCount,
      finalResponseCount,
      toolCallPartCount,
      toolResponsePartCount,
      textPartCount,
      fallbackTextChars: fallbackText.length,
    },
  }
}

export interface AdkGraphPipelineResult {
  readonly signal: Signal
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
}

export async function runAdkSignalsPipeline(
  userId: string,
): Promise<AgentResult<ReadonlyArray<Signal>>> {
  const start = performance.now()
  ensureAdkEnvironment()

  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return {
      success: false,
      error: 'User id is required',
      durationMs: performance.now() - start,
    }
  }

  if (!hasAdkApiKey()) {
    return {
      success: false,
      error: 'GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY / GOOGLE_API_KEY) is required for ADK runtime',
      durationMs: performance.now() - start,
    }
  }

  try {
    traceAdk('signals:start', {
      userId: normalizedUserId,
      model: SIGNALS_MODEL,
    })

    const { stateValue, fallbackText, diagnostics } = await runAdkToolCall({
      runner: signalsRunner,
      appName: SIGNALS_APP_NAME,
      userId: normalizedUserId,
      stateKey: SIGNALS_STATE_KEY,
      payload: { userId: normalizedUserId },
    })
    traceAdkVerbose('signals:run', {
      userId: normalizedUserId,
      diagnostics,
      fallbackTextPreview: compactTextSnippet(fallbackText),
      fallbackTextChars: fallbackText.length,
      stateValueType: describeCandidate(stateValue),
    })

    const candidate = stateValue ?? extractFirstJsonBlock(fallbackText)
    if (isToolErrorResult(candidate)) {
      traceAdk('signals:error', {
        userId: normalizedUserId,
        reason: 'tool-error',
        diagnostics,
        error: candidate.error,
        durationMs: Math.round(performance.now() - start),
      })
      return {
        success: false,
        error: candidate.error,
        durationMs: performance.now() - start,
      }
    }

    if (!isSignalListDetailedContext(candidate)) {
      traceAdk('signals:error', {
        userId: normalizedUserId,
        reason: 'invalid-payload',
        diagnostics,
        candidateType: describeCandidate(candidate),
        fallbackTextPreview: compactTextSnippet(fallbackText),
        durationMs: Math.round(performance.now() - start),
      })
      return {
        success: false,
        error: 'ADK orchestration returned invalid signals payload',
        durationMs: performance.now() - start,
      }
    }

    traceAdk('signals:success', {
      userId: normalizedUserId,
      signalCount: candidate.signals.length,
      diagnostics,
      durationMs: Math.round(performance.now() - start),
    })

    return {
      success: true,
      data: candidate.signals,
      durationMs: performance.now() - start,
    }
  } catch (error) {
    traceAdk('signals:error', {
      userId: normalizedUserId,
      reason: 'exception',
      error: error instanceof Error ? error.message : 'Unknown ADK signals orchestration error',
      durationMs: Math.round(performance.now() - start),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown ADK signals orchestration error',
      durationMs: performance.now() - start,
    }
  }
}

export async function runAdkGraphPipeline(
  userId: string,
  signalId?: string,
): Promise<AgentResult<AdkGraphPipelineResult>> {
  const start = performance.now()
  ensureAdkEnvironment()

  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return {
      success: false,
      error: 'User id is required',
      durationMs: performance.now() - start,
    }
  }

  if (!hasAdkApiKey()) {
    return {
      success: false,
      error: 'GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY / GOOGLE_API_KEY) is required for ADK runtime',
      durationMs: performance.now() - start,
    }
  }

  const payload: Record<string, string> = { userId: normalizedUserId }
  const normalizedSignalId = signalId?.trim()
  if (normalizedSignalId) payload.signalId = normalizedSignalId

  try {
    traceAdk('graph:start', {
      userId: normalizedUserId,
      signalId: normalizedSignalId ?? 'default',
      model: GRAPH_MODEL,
    })

    const { stateValue, fallbackText, diagnostics } = await runAdkToolCall({
      runner: graphRunner,
      appName: GRAPH_APP_NAME,
      userId: normalizedUserId,
      stateKey: GRAPH_STATE_KEY,
      payload,
    })
    traceAdkVerbose('graph:run', {
      userId: normalizedUserId,
      signalId: normalizedSignalId ?? 'default',
      diagnostics,
      fallbackTextPreview: compactTextSnippet(fallbackText),
      stateValueType: describeCandidate(stateValue),
    })

    const candidate = stateValue ?? extractFirstJsonBlock(fallbackText)
    if (isToolErrorResult(candidate)) {
      traceAdk('graph:error', {
        userId: normalizedUserId,
        signalId: normalizedSignalId ?? 'default',
        reason: 'tool-error',
        diagnostics,
        error: candidate.error,
        durationMs: Math.round(performance.now() - start),
      })
      return {
        success: false,
        error: candidate.error,
        durationMs: performance.now() - start,
      }
    }

    if (!isSignalGraphPipelineContext(candidate)) {
      traceAdk('graph:error', {
        userId: normalizedUserId,
        signalId: normalizedSignalId ?? 'default',
        reason: 'invalid-payload',
        diagnostics,
        candidateType: describeCandidate(candidate),
        fallbackTextPreview: compactTextSnippet(fallbackText),
        durationMs: Math.round(performance.now() - start),
      })
      return {
        success: false,
        error: 'ADK orchestration returned invalid graph payload',
        durationMs: performance.now() - start,
      }
    }

    traceAdk('graph:success', {
      userId: normalizedUserId,
      signalId: normalizedSignalId ?? candidate.signal.id,
      nodeCount: candidate.chain.nodes.length,
      edgeCount: candidate.chain.edges.length,
      diagnostics,
      durationMs: Math.round(performance.now() - start),
    })

    return {
      success: true,
      data: {
        signal: candidate.signal,
        chain: candidate.chain,
        temporalAnalysis: candidate.temporalAnalysis,
      },
      durationMs: performance.now() - start,
    }
  } catch (error) {
    traceAdk('graph:error', {
      userId: normalizedUserId,
      signalId: normalizedSignalId ?? 'default',
      reason: 'exception',
      error: error instanceof Error ? error.message : 'Unknown ADK graph orchestration error',
      durationMs: Math.round(performance.now() - start),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown ADK graph orchestration error',
      durationMs: performance.now() - start,
    }
  }
}
