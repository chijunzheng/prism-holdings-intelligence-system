import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { CausalChain, StrategyScenarioItem } from '@prism/shared'
import {
  CompareWorkspaceBranchesRequestSchema,
  CreateWorkspaceBranchRequestSchema,
  CreateWorkspaceCheckpointRequestSchema,
  CreateWorkspaceSessionRequestSchema,
  UpdateWorkspaceBranchRequestSchema,
  UpdateWorkspaceSessionRequestSchema,
  WorkspaceOperationAppendRequestSchema,
} from '@prism/shared'
import { getPortfolioByUserId, getFundComposition, getUserProfileById, getUserProfiles } from '@prism/data'
import {
  listPlanSessions,
  getPlanSession,
  createPlanSession,
  updatePlanSession,
  deletePlanSession,
  CreatePlanSessionRequestSchema as CreatePlanReqSchema,
  UpdatePlanSessionRequestSchema as UpdatePlanReqSchema,
} from './plan-session-service'
import { analyze } from '@prism/agents/src/exposure-analyzer/index'
import {
  runExposureAnalysis,
  runSignalMonitor,
  prewarmCausalChains,
  runGraphPipeline,
  runPortfolioNetImpactPipeline,
  clearCaches,
  type PipelineContext,
} from '@prism/agents/src/orchestrator/index'
import {
  generateInitialMessage,
  streamChatResponse,
  generateGeneralInitialMessage,
  streamGeneralChatResponse,
  detectWhatIf,
  streamAskPrismResponse,
} from '@prism/agents/src/chat-agent/index'
import { buildChatContext } from '@prism/agents/src/chat-agent/context-builder'
import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearUserNotifications,
  subscribeSse,
} from './notification-service'
import {
  trackActiveUser,
  startBackgroundChecker,
  clearCheckerState,
} from './background-signal-checker'
import {
  createStrategyDraft,
  evaluateStrategy,
  parseStrategyDraftRequest,
  parseStrategyEvaluateRequest,
} from './strategy-service'
import {
  buildPlanCopilotProposalResponse,
  parsePlanCopilotRequest,
} from './plan-copilot-service'
import {
  appendWorkspaceOperation,
  compareWorkspaceBranches,
  createWorkspaceBranch,
  createWorkspaceCheckpoint,
  createWorkspaceSession,
  getWorkspaceSessionBundle,
  listWorkspaceSessions,
  restoreWorkspaceCheckpoint,
  updateWorkspaceBranch,
  updateWorkspaceSession,
} from './workspace-session-service'
import type { ChatMessage as AgentChatMessage } from '@prism/agents/src/chat-agent/types'
import {
  runAdkGraphPipeline,
  runAdkSignalsPipeline,
  runPrismAdkPrompt,
} from '@prism/agents/src/adk/index'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(__dirname, '../../.env'),
  ]

  const envPath = candidates.find((path) => existsSync(path))
  if (!envPath) return

  const content = readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const equalsIndex = line.indexOf('=')
    if (equalsIndex <= 0) continue

    const rawKey = line.slice(0, equalsIndex).trim()
    const key = rawKey.startsWith('export ') ? rawKey.slice(7).trim() : rawKey
    if (!key) continue

    let value = line.slice(equalsIndex + 1).trim()
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))

    if (isQuoted) {
      value = value.slice(1, -1)
    } else if (value.includes('#')) {
      // Allow inline comments on unquoted values.
      value = value.split('#', 1)[0].trim()
    }

    // Make .env authoritative for this process to avoid stale shell exports.
    process.env[key] = value
  }
}

loadEnvFile()

if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const TRACE_IMPACT =
  isTruthyEnv(process.env.DEBUG_IMPACT_TRACE) || isTruthyEnv(process.env.PRISM_TRACE)
const ADK_EMPTY_SIGNAL_IS_VALID = isTruthyEnv(process.env.PRISM_ADK_EMPTY_SIGNAL_IS_VALID)

const USE_ADK_ORCHESTRATION = !['0', 'false', 'no', 'off'].includes(
  (process.env.PRISM_USE_ADK_ORCHESTRATION ?? 'true').trim().toLowerCase(),
)

function traceImpact(scope: string, payload: Record<string, unknown>): void {
  if (!TRACE_IMPACT) return
  // eslint-disable-next-line no-console
  console.log(`[PrismTrace][${scope}]`, payload)
}

function warnImpact(scope: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(`[PrismWarn][${scope}]`, payload)
}

function readTruthyQuery(value: unknown): boolean {
  if (typeof value === 'string') return isTruthyEnv(value)
  if (Array.isArray(value) && value.length > 0) return isTruthyEnv(String(value[0] ?? ''))
  return false
}

function summarizeSignalUrgency(
  signals: ReadonlyArray<{ readonly urgency: string }>,
): {
  readonly totalSignals: number
  readonly urgencyBreakdown: {
    readonly low: number
    readonly medium: number
    readonly high: number
    readonly critical: number
  }
} {
  const urgencyBreakdown = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }

  for (const signal of signals) {
    if (signal.urgency === 'low') urgencyBreakdown.low += 1
    else if (signal.urgency === 'medium') urgencyBreakdown.medium += 1
    else if (signal.urgency === 'high') urgencyBreakdown.high += 1
    else if (signal.urgency === 'critical') urgencyBreakdown.critical += 1
  }

  return {
    totalSignals: signals.length,
    urgencyBreakdown,
  }
}

function extractSubgraphByDepth(chain: CausalChain, seedNodeId: string, depth: number): CausalChain {
  const cappedDepth = Math.max(0, Math.min(depth, 4))
  const nodeById = new Map(chain.nodes.map((node) => [node.id, node]))
  if (!nodeById.has(seedNodeId)) return chain

  const adjacency = new Map<string, Set<string>>()
  for (const node of chain.nodes) adjacency.set(node.id, new Set())
  for (const edge of chain.edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }

  const visited = new Set<string>([seedNodeId])
  const queue: Array<{ readonly id: string; readonly level: number }> = [{ id: seedNodeId, level: 0 }]
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    if (next.level >= cappedDepth) continue
    const neighbors = adjacency.get(next.id)
    if (!neighbors) continue
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push({ id: neighbor, level: next.level + 1 })
    }
  }

  const nodes = chain.nodes.filter((node) => visited.has(node.id))
  const edges = chain.edges.filter((edge) => visited.has(edge.source) && visited.has(edge.target))

  return {
    ...chain,
    id: `${chain.id}-expand-${seedNodeId}-${cappedDepth}`,
    nodes,
    edges,
    summary: `Expanded subgraph around ${seedNodeId} (depth ${cappedDepth}).`,
  }
}

const app = express()
const port = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

// Track active users from any request with :userId param
app.use('/api/:resource/:userId', (req, _res, next) => {
  if (req.params.userId && req.params.userId.length > 1) {
    trackActiveUser(req.params.userId)
  }
  next()
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Direct ADK endpoint for debugging and orchestration integration checks.
app.post('/api/adk/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  const userId =
    typeof req.body?.userId === 'string' && req.body.userId.trim()
      ? req.body.userId.trim()
      : 'sarah-01'
  const sessionId =
    typeof req.body?.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : undefined

  if (!message) {
    res.status(400).json({ success: false, error: 'message is required' })
    return
  }

  const result = await runPrismAdkPrompt({ message, userId, sessionId })
  if (!result.success || !result.data) {
    res.status(500).json({
      success: false,
      error: result.error ?? 'Failed to run ADK chat prompt',
    })
    return
  }

  res.json({ success: true, data: result.data })
})

// Demo profiles endpoint
app.get('/api/profiles', (_req, res) => {
  const profiles = getUserProfiles().map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    riskTolerance: p.riskTolerance,
    context: p.context,
    shortContext: p.shortContext,
  }))
  res.json({ success: true, data: profiles })
})

// Exposure analysis endpoint
app.get('/api/portfolio/:userId', (req, res) => {
  const portfolio = getPortfolioByUserId(req.params.userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }
  res.json({ success: true, data: portfolio })
})

app.get('/api/exposure/:userId', async (req, res) => {
  const portfolio = getPortfolioByUserId(req.params.userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const result = await analyze(portfolio, getFundComposition)
  if (!result.success) {
    res.status(500).json(result)
    return
  }

  res.json(result)
})

// Helper to build pipeline context
function buildPipelineCtx(userId: string): PipelineContext | null {
  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) return null
  const profile = getUserProfileById(userId)
  if (!profile) return null
  return { portfolio, profile, getFundComposition }
}

// Live signal endpoint (orchestrated with caching)
app.get('/api/signals/:userId', async (req, res) => {
  const requestStartedAt = performance.now()
  const requestId = randomUUID().slice(0, 8)
  const forceRefresh =
    readTruthyQuery(req.query.refresh) ||
    readTruthyQuery(req.query.forceRefresh) ||
    readTruthyQuery(req.query.invalidateCache)
  res.setHeader('x-prism-trace-id', requestId)

  if (forceRefresh) {
    clearCaches()
    traceImpact('signals:cache-cleared', {
      requestId,
      userId: req.params.userId,
      reason: 'refresh-query',
    })
  }

  traceImpact('signals:start', {
    requestId,
    userId: req.params.userId,
    forceRefresh,
    orchestration: USE_ADK_ORCHESTRATION ? 'adk-first' : 'manual',
  })

  if (USE_ADK_ORCHESTRATION) {
    const adkResult = await runAdkSignalsPipeline(req.params.userId)
    if (adkResult.success && adkResult.data) {
      const signalSummary = summarizeSignalUrgency(adkResult.data)
      if (adkResult.data.length === 0 && !ADK_EMPTY_SIGNAL_IS_VALID) {
        traceImpact('signals:adk-empty-fallback', {
          requestId,
          userId: req.params.userId,
          reason: 'adk-returned-empty-signal-list',
          durationMs: Math.round(performance.now() - requestStartedAt),
        })
      } else {
        traceImpact('signals:success', {
          requestId,
          userId: req.params.userId,
          mode: 'adk',
          signalCount: adkResult.data.length,
          durationMs: Math.round(performance.now() - requestStartedAt),
        })
        res.json({
          success: true,
          data: adkResult.data,
          durationMs: adkResult.durationMs,
          mode: 'adk',
          requestId,
          debug: signalSummary,
        })
        return
      }
    } else {
      traceImpact('signals:adk-error', {
        requestId,
        userId: req.params.userId,
        mode: 'adk-error-fallback',
        signalCount: 0,
        error: adkResult.error ?? 'Unknown ADK signals error',
        durationMs: Math.round(performance.now() - requestStartedAt),
      })
      warnImpact('signals:adk-error', {
        requestId,
        userId: req.params.userId,
        error: adkResult.error ?? 'Unknown ADK signals error',
      })
    }
  }

  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    traceImpact('signals:not-found', {
      requestId,
      userId: req.params.userId,
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) {
    traceImpact('signals:exposure-error', {
      requestId,
      userId: req.params.userId,
      durationMs: Math.round(performance.now() - requestStartedAt),
      error: exposureResult.error ?? 'Exposure analysis failed',
    })
    res.status(500).json({ success: false, error: exposureResult.error ?? 'Exposure analysis failed' })
    return
  }

  const signalResult = await runSignalMonitor(exposureResult.data)
  if (!signalResult.success) {
    traceImpact('signals:monitor-error', {
      requestId,
      userId: req.params.userId,
      exposureDurationMs: Math.round(exposureResult.durationMs),
      durationMs: Math.round(performance.now() - requestStartedAt),
      error: signalResult.error ?? 'Signal monitoring failed',
    })
    res.status(500).json({ success: false, error: signalResult.error ?? 'Signal monitoring failed' })
    return
  }

  // Best-effort background prewarm for fastest graph open from signal cards.
  if (signalResult.data && exposureResult.data) {
    void prewarmCausalChains(exposureResult.data, signalResult.data)
  }

  traceImpact('signals:success', {
    requestId,
    userId: req.params.userId,
    mode: USE_ADK_ORCHESTRATION ? 'manual-fallback' : 'manual',
    signalCount: signalResult.data?.length ?? 0,
    exposureDurationMs: Math.round(exposureResult.durationMs),
    monitorDurationMs: Math.round(signalResult.durationMs),
    durationMs: Math.round(performance.now() - requestStartedAt),
  })
  const normalizedSignals = signalResult.data ?? []
  const signalSummary = summarizeSignalUrgency(normalizedSignals)
  if (normalizedSignals.length === 0) {
    warnImpact('signals:empty', {
      requestId,
      userId: req.params.userId,
      mode: USE_ADK_ORCHESTRATION ? 'manual-fallback' : 'manual',
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
  }
  res.json({
    success: true,
    data: normalizedSignals,
    durationMs: signalResult.durationMs,
    mode: USE_ADK_ORCHESTRATION ? 'manual-fallback' : 'manual',
    requestId,
    debug: signalSummary,
  })
})

// Causal graph data endpoint (full orchestrated pipeline)
app.get('/api/graph/:userId/:signalId', async (req, res) => {
  const requestStartedAt = performance.now()
  traceImpact('graph:start', {
    userId: req.params.userId,
    signalId: decodeURIComponent(req.params.signalId),
    orchestration: USE_ADK_ORCHESTRATION ? 'adk-first' : 'manual',
  })

  const signalId = decodeURIComponent(req.params.signalId)
  if (USE_ADK_ORCHESTRATION) {
    const adkResult = await runAdkGraphPipeline(req.params.userId, signalId)
    if (adkResult.success && adkResult.data) {
      traceImpact('graph:success', {
        userId: req.params.userId,
        signalId,
        mode: 'adk',
        nodeCount: adkResult.data.chain.nodes.length,
        edgeCount: adkResult.data.chain.edges.length,
        durationMs: Math.round(performance.now() - requestStartedAt),
      })
      res.json({
        success: true,
        data: adkResult.data,
        durationMs: adkResult.durationMs,
      })
      return
    }

    traceImpact('graph:adk-error', {
      userId: req.params.userId,
      signalId,
      error: adkResult.error ?? 'Unknown ADK graph error',
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
  }

  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    traceImpact('graph:not-found', {
      userId: req.params.userId,
      signalId: decodeURIComponent(req.params.signalId),
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const result = await runGraphPipeline(ctx, signalId)

  if (!result.success || !result.data) {
    traceImpact('graph:error', {
      userId: req.params.userId,
      signalId,
      error: result.error ?? 'Graph pipeline failed',
      pipelineDurationMs: Math.round(result.durationMs),
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
    res.status(500).json({ success: false, error: result.error })
    return
  }

  traceImpact('graph:success', {
    userId: req.params.userId,
    signalId,
    nodeCount: result.data.chain.nodes.length,
    edgeCount: result.data.chain.edges.length,
    pipelineDurationMs: Math.round(result.durationMs),
    durationMs: Math.round(performance.now() - requestStartedAt),
  })
  res.json({ success: true, data: result.data })
})

// Causal graph incremental expansion endpoint
app.post('/api/graph/:userId/:signalId/expand', async (req, res) => {
  const signalId = decodeURIComponent(req.params.signalId)
  const nodeId = typeof req.body?.nodeId === 'string' ? req.body.nodeId : ''
  const depthInput = Number(req.body?.depth ?? 1)
  const depth = Number.isFinite(depthInput) ? depthInput : 1

  if (!nodeId) {
    res.status(400).json({ success: false, error: 'nodeId is required' })
    return
  }

  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const result = await runGraphPipeline(ctx, signalId)
  if (!result.success || !result.data) {
    res.status(500).json({ success: false, error: result.error ?? 'Graph pipeline failed' })
    return
  }

  const expandedChain = extractSubgraphByDepth(result.data.chain, nodeId, depth)
  res.json({
    success: true,
    data: {
      signal: result.data.signal,
      chain: expandedChain,
      temporalAnalysis: result.data.temporalAnalysis,
    },
  })
})

// Portfolio net impact endpoint (aggregates all signals above threshold)
app.get('/api/impact/:userId/net', async (req, res) => {
  const requestStartedAt = performance.now()
  traceImpact('impact-net:start', {
    userId: req.params.userId,
  })

  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    traceImpact('impact-net:not-found', {
      userId: req.params.userId,
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const result = await runPortfolioNetImpactPipeline(ctx)
  if (!result.success || !result.data) {
    traceImpact('impact-net:error', {
      userId: req.params.userId,
      error: result.error ?? 'Portfolio net impact failed',
      durationMs: Math.round(performance.now() - requestStartedAt),
    })
    res.status(500).json({ success: false, error: result.error ?? 'Portfolio net impact failed' })
    return
  }

  traceImpact('impact-net:success', {
    userId: req.params.userId,
    includedSignalCount: result.data.includedSignalCount,
    signalUniverseCount: result.data.signalUniverseCount,
    durationMs: Math.round(performance.now() - requestStartedAt),
  })
  res.json({
    success: true,
    data: result.data,
    durationMs: result.durationMs,
  })
})

// Strategy draft endpoint (closed-loop mitigation planning)
app.post('/api/strategy/:userId/draft', async (req, res) => {
  const requestStartedAt = performance.now()
  const parseResult = parseStrategyDraftRequest(req.body)
  if (!parseResult.ok) {
    res.status(400).json({ success: false, error: parseResult.error })
    return
  }

  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const result = await createStrategyDraft(ctx, parseResult.data)
  if (!result.success || !result.data) {
    res.status(500).json({ success: false, error: result.error ?? 'Failed to build strategy draft' })
    return
  }

  traceImpact('strategy:draft:success', {
    userId: req.params.userId,
    signalId: result.data.signalId,
    candidateCount: result.data.candidates.length,
    scenarioItems: result.data.scenario.items.length,
    durationMs: Math.round(performance.now() - requestStartedAt),
  })

  res.json({
    success: true,
    data: result.data,
    durationMs: result.durationMs,
  })
})

// Strategy scenario evaluation endpoint
app.post('/api/strategy/:userId/evaluate', async (req, res) => {
  const requestStartedAt = performance.now()
  const parseResult = parseStrategyEvaluateRequest(req.body)
  if (!parseResult.ok) {
    res.status(400).json({ success: false, error: parseResult.error })
    return
  }

  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const result = await evaluateStrategy(ctx, parseResult.data)
  if (!result.success || !result.data) {
    res.status(500).json({ success: false, error: result.error ?? 'Failed to evaluate strategy scenario' })
    return
  }

  traceImpact('strategy:evaluate:success', {
    userId: req.params.userId,
    signalId: parseResult.data.signalId ?? null,
    turnoverPct: result.data.turnoverPct,
    score: result.data.score,
    durationMs: Math.round(performance.now() - requestStartedAt),
  })

  res.json({
    success: true,
    data: result.data,
    durationMs: result.durationMs,
  })
})

// Strategy copilot proposal endpoint for Ask Prism Playbook chat
app.post('/api/strategy/:userId/copilot-proposal', async (req, res) => {
  const parseResult = parsePlanCopilotRequest(req.body)
  if (!parseResult.ok) {
    res.status(400).json({ success: false, error: parseResult.error })
    return
  }

  const payload = parseResult.data
  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  try {
    const effectiveSignalId = payload.entryContext?.signalId ?? payload.signalId
    const sessionScope = resolveAskPrismSessionScope(
      {
        page: 'plan',
        signalId: effectiveSignalId,
        sessionScope: payload.sessionScope,
        entryContext: payload.entryContext,
        planSelections: payload.currentSelections,
        history: payload.history,
        message: payload.message,
      },
      effectiveSignalId,
    )

    const exposureResult = await runExposureAnalysis(ctx)
    if (!exposureResult.success || !exposureResult.data) {
      res.status(500).json({ success: false, error: 'Failed to load exposure data' })
      return
    }

    const signalResult = await runSignalMonitor(exposureResult.data)
    if (!signalResult.success || !signalResult.data) {
      res.status(500).json({ success: false, error: 'Failed to load signals' })
      return
    }

    const holdings: import('@prism/shared').Holding[] = []
    for (const account of ctx.portfolio.accounts) {
      for (const holding of account.holdings) {
        holdings.push(holding)
      }
    }

    const context: import('@prism/shared').AskPrismContext = {
      page: 'plan',
      sessionScope,
      entryContext: payload.entryContext,
      profile: ctx.profile,
      holdings,
      exposureMap: exposureResult.data,
      activeSignals: signalResult.data,
      strategyCandidates: payload.candidateUniverse,
      currentPlan: payload.currentSelections,
      contextSnapshotMeta: {
        generatedAt: new Date().toISOString(),
        activeSignalCount: signalResult.data.length,
        signalSourceSummary: signalResult.data.map((signal) => ({
          signalId: signal.id,
          sourceCount: signal.sources.length,
        })),
      },
    }

    if (effectiveSignalId && effectiveSignalId !== 'portfolio-net') {
      const graphResult = await runGraphPipeline(ctx, effectiveSignalId)
      if (graphResult.success && graphResult.data) {
        const { signal, chain, temporalAnalysis } = graphResult.data
        const focusedNodeId = payload.entryContext?.nodeId ?? extractNodeIdFromScope(sessionScope)
        const focusedNode = focusedNodeId
          ? chain.nodes.find((node) => node.id === focusedNodeId)
          : undefined

        const askPrismTemporal: import('@prism/shared').AskPrismTemporalAnalysis = {
          classification: temporalAnalysis.classification,
          confidence: temporalAnalysis.confidence,
          timeBuckets: {
            oneWeek: { expectedDollarImpact: temporalAnalysis.timeBuckets.oneWeek.expectedDollarImpact },
            oneMonth: { expectedDollarImpact: temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact },
            sixMonth: { expectedDollarImpact: temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact },
          },
          counterfactual: temporalAnalysis.counterfactual,
        }

        Object.assign(context, {
          focusedSignal: signal,
          causalChain: chain,
          temporalAnalysis: askPrismTemporal,
          focusedNode,
          contextSnapshotMeta: {
            ...context.contextSnapshotMeta,
            focusedSignalDetectedAt: signal.detectedAt,
          },
        })
      }
    }

    if (payload.currentSelections.length > 0 && payload.candidateUniverse.length > 0) {
      const scenarioItems = buildScenarioItemsFromSelections(
        payload.currentSelections,
        payload.candidateUniverse,
      )
      if (scenarioItems.length > 0) {
        const evaluationResult = await evaluateStrategy(ctx, {
          signalId: effectiveSignalId,
          scenario: { items: scenarioItems },
        })
        if (evaluationResult.success && evaluationResult.data) {
          Object.assign(context, { evaluation: evaluationResult.data })
        }
      }
    }

    const history = normalizeAskPrismHistory(payload.history)
    const assistantText = await collectStreamedText(
      streamAskPrismResponse(context, history, payload.message, sessionScope),
    )

    const topExposure = [...exposureResult.data.exposures]
      .sort((a, b) => b.percentage - a.percentage)[0]

    const response = buildPlanCopilotProposalResponse({
      message: payload.message,
      assistantText,
      currentSelections: payload.currentSelections,
      candidateUniverse: payload.candidateUniverse,
      signalHeadline: context.focusedSignal?.headline,
      signalOneMonthImpactCad: context.temporalAnalysis?.timeBuckets.oneMonth.expectedDollarImpact,
      topExposureLabel: topExposure ? `${topExposure.category} (${topExposure.percentage.toFixed(1)}%)` : undefined,
      warningCount: exposureResult.data.warnings.length,
    })

    res.json({ success: true, data: response })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate copilot proposal'
    res.status(500).json({ success: false, error: message })
  }
})

// ── Plan Session Endpoints ─────────────────────────────────────

app.get('/api/plans/:userId', (_req, res) => {
  const data = listPlanSessions(_req.params.userId)
  res.json({ success: true, data })
})

app.get('/api/plans/:userId/:sessionId', (req, res) => {
  try {
    const data = getPlanSession(req.params.userId, req.params.sessionId)
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan session not found'
    res.status(404).json({ success: false, error: message })
  }
})

app.post('/api/plans/:userId', (req, res) => {
  const parsed = CreatePlanReqSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }
  const data = createPlanSession(req.params.userId, parsed.data)
  res.json({ success: true, data })
})

app.patch('/api/plans/:userId/:sessionId', (req, res) => {
  const parsed = UpdatePlanReqSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }
  try {
    const data = updatePlanSession(req.params.userId, req.params.sessionId, parsed.data)
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan session not found'
    res.status(404).json({ success: false, error: message })
  }
})

app.delete('/api/plans/:userId/:sessionId', (req, res) => {
  try {
    deletePlanSession(req.params.userId, req.params.sessionId)
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan session not found'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace sessions list
app.get('/api/workspace/:userId/sessions', async (req, res) => {
  const data = await listWorkspaceSessions(req.params.userId)
  res.json({ success: true, data })
})

// Workspace session create
app.post('/api/workspace/:userId/sessions', async (req, res) => {
  const parsed = CreateWorkspaceSessionRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const data = await createWorkspaceSession(req.params.userId, parsed.data)
  res.json({ success: true, data })
})

// Workspace session details
app.get('/api/workspace/:userId/sessions/:sessionId', async (req, res) => {
  try {
    const data = await getWorkspaceSessionBundle(req.params.userId, req.params.sessionId)
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace session not found'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace session update
app.patch('/api/workspace/:userId/sessions/:sessionId', async (req, res) => {
  const parsed = UpdateWorkspaceSessionRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const data = await updateWorkspaceSession(req.params.userId, req.params.sessionId, parsed.data)
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace session not found'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace branch create
app.post('/api/workspace/:userId/sessions/:sessionId/branches', async (req, res) => {
  const parsed = CreateWorkspaceBranchRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const data = await createWorkspaceBranch(req.params.userId, req.params.sessionId, parsed.data)
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace branch operation failed'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace branch update
app.patch('/api/workspace/:userId/sessions/:sessionId/branches/:branchId', async (req, res) => {
  const parsed = UpdateWorkspaceBranchRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const data = await updateWorkspaceBranch(
      req.params.userId,
      req.params.sessionId,
      req.params.branchId,
      parsed.data,
    )
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace branch operation failed'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace checkpoint create
app.post('/api/workspace/:userId/sessions/:sessionId/checkpoints', async (req, res) => {
  const parsed = CreateWorkspaceCheckpointRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const data = await createWorkspaceCheckpoint(req.params.userId, req.params.sessionId, parsed.data)
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace checkpoint operation failed'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace checkpoint restore
app.post('/api/workspace/:userId/sessions/:sessionId/restore/:checkpointId', async (req, res) => {
  try {
    const data = await restoreWorkspaceCheckpoint(
      req.params.userId,
      req.params.sessionId,
      req.params.checkpointId,
    )
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace checkpoint operation failed'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace branch compare
app.post('/api/workspace/:userId/sessions/:sessionId/compare', async (req, res) => {
  const parsed = CompareWorkspaceBranchesRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const data = await compareWorkspaceBranches(
      req.params.userId,
      req.params.sessionId,
      parsed.data.leftBranchId,
      parsed.data.rightBranchId,
    )
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace compare failed'
    res.status(404).json({ success: false, error: message })
  }
})

// Workspace operation append (optionally autosave snapshot)
app.post('/api/workspace/:userId/sessions/:sessionId/operations', async (req, res) => {
  const parsed = WorkspaceOperationAppendRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const data = await appendWorkspaceOperation(
      req.params.userId,
      req.params.sessionId,
      {
        branchId: parsed.data.branchId,
        type: parsed.data.type,
        payload: parsed.data.payload ?? {},
        actor: parsed.data.actor ?? 'human',
      },
      parsed.data.snapshot,
    )
    res.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace operation failed'
    res.status(404).json({ success: false, error: message })
  }
})

// Clear caches (used on profile switch)
app.post('/api/cache/clear', (_req, res) => {
  clearCaches()
  res.json({ success: true })
})

// Clear notification checker state for a user (used on profile switch)
app.post('/api/cache/clear/:userId', (req, res) => {
  clearCheckerState(req.params.userId)
  clearUserNotifications(req.params.userId)
  res.json({ success: true })
})

// ── Chat Endpoints ───────────────────────────────────────────

interface ChatRequestBody {
  readonly node: import('@prism/shared').CausalChainNode
  readonly chain: import('@prism/shared').CausalChain
  readonly signal: import('@prism/shared').Signal
  readonly temporalAnalysis: import('@prism/agents/src/chat-agent/types').TemporalAnalysis
  readonly history?: ReadonlyArray<AgentChatMessage>
  readonly message?: string
}

// Initial context message when a node is selected
app.post('/api/chat/:userId/init', async (req, res) => {
  const { userId } = req.params
  const body = req.body as ChatRequestBody

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const profile = getUserProfileById(userId)
  if (!profile) {
    res.status(404).json({ success: false, error: 'User profile not found' })
    return
  }

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({ success: false, error: 'Failed to load exposure data' })
    return
  }

  const context = buildChatContext(
    body.node,
    body.chain,
    body.signal,
    exposureResult.data,
    profile,
    body.temporalAnalysis,
  )

  const result = await generateInitialMessage(context)
  if (result.error) {
    res.status(500).json({ success: false, error: result.error })
    return
  }

  res.json({ success: true, data: { content: result.content } })
})

// Streaming chat response
app.post('/api/chat/:userId/message', async (req, res) => {
  const { userId } = req.params
  const body = req.body as ChatRequestBody & { readonly message: string }

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const profile = getUserProfileById(userId)
  if (!profile) {
    res.status(404).json({ success: false, error: 'User profile not found' })
    return
  }

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({ success: false, error: 'Failed to load exposure data' })
    return
  }

  const context = buildChatContext(
    body.node,
    body.chain,
    body.signal,
    exposureResult.data,
    profile,
    body.temporalAnalysis,
  )

  // Set up SSE for streaming
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const history: ReadonlyArray<AgentChatMessage> = body.history ?? []

  for await (const chunk of streamChatResponse(context, history, body.message)) {
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
})

// ── Unified Ask Prism Chat ─────────────────────────────────────

interface AskPrismChatRequestBody {
  readonly page: import('@prism/shared').AskPrismPage
  readonly signalId?: string
  readonly sessionScope?: import('@prism/shared').AskPrismSessionScope
  readonly entryContext?: import('@prism/shared').AskPrismEntryContext
  readonly planSelections?: ReadonlyArray<import('@prism/shared').PlanSelection>
  readonly message: string
  readonly history?: ReadonlyArray<{
    readonly role: string
    readonly content: string
  }>
}

function resolveAskPrismSessionScope(
  body: AskPrismChatRequestBody,
  signalId?: string,
): import('@prism/shared').AskPrismSessionScope {
  const provided = body.sessionScope?.trim()
  if (provided === 'global') return 'global'
  if (provided && /^plan:[^:]+$/.test(provided)) return provided as import('@prism/shared').AskPrismSessionScope
  if (provided && /^signal:[^:]+$/.test(provided)) return provided as import('@prism/shared').AskPrismSessionScope
  if (provided && /^node:[^:]+:[^:]+$/.test(provided)) return provided as import('@prism/shared').AskPrismSessionScope

  const effectiveSignalId = body.entryContext?.signalId ?? signalId
  if (body.entryContext?.nodeId && effectiveSignalId) {
    return `node:${effectiveSignalId}:${body.entryContext.nodeId}`
  }
  if (effectiveSignalId && body.page === 'plan') {
    return `plan:${effectiveSignalId}`
  }
  if (effectiveSignalId && (body.page === 'signal' || body.page === 'signals_overview')) {
    return `signal:${effectiveSignalId}`
  }
  return 'global'
}

function extractNodeIdFromScope(scope: import('@prism/shared').AskPrismSessionScope): string | undefined {
  if (!scope.startsWith('node:')) return undefined
  const pieces = scope.split(':')
  if (pieces.length < 3) return undefined
  return pieces.slice(2).join(':')
}

function normalizeAskPrismHistory(
  history?: ReadonlyArray<{ readonly role: string; readonly content: string }>,
): ReadonlyArray<AgentChatMessage> {
  if (!history) return []
  return history
    .filter((message): message is { readonly role: 'user' | 'assistant'; readonly content: string } =>
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

function clampPlanAllocation(value: number): number {
  return Math.max(0.5, Math.min(value, 10))
}

function buildScenarioItemsFromSelections(
  selections: ReadonlyArray<import('@prism/shared').PlanSelection>,
  candidates: ReadonlyArray<import('@prism/shared').StrategyCandidate>,
): ReadonlyArray<StrategyScenarioItem> {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  return selections
    .map((selection): StrategyScenarioItem | null => {
      const candidate = candidateById.get(selection.candidateId)
      if (!candidate) return null
      return {
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
        allocationPct: clampPlanAllocation(selection.allocationPct),
      }
    })
    .filter((item): item is StrategyScenarioItem => item !== null)
}

async function collectStreamedText(
  stream: AsyncGenerator<string, void, undefined>,
): Promise<string> {
  let output = ''
  for await (const chunk of stream) {
    output += chunk
  }
  return output.trim()
}

app.post('/api/chat/:userId/ask-prism', async (req, res) => {
  const { userId } = req.params
  const body = req.body as AskPrismChatRequestBody

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const profile = getUserProfileById(userId)
  if (!profile) {
    res.status(404).json({ success: false, error: 'User profile not found' })
    return
  }

  try {
    const effectiveSignalId = body.entryContext?.signalId ?? body.signalId
    const sessionScope = resolveAskPrismSessionScope(body, effectiveSignalId)
    let signalsOverviewChain: CausalChain | undefined

    // Build pipeline context for orchestrator
    const pipelineContext: PipelineContext = {
      portfolio,
      profile,
      getFundComposition,
    }

    // Layer 1: Always load exposure and signals
    const exposureResult = await runExposureAnalysis(pipelineContext)
    if (!exposureResult.success || !exposureResult.data) {
      res.status(500).json({ success: false, error: 'Failed to load exposure data' })
      return
    }

    const signalResult = await runSignalMonitor(exposureResult.data)
    if (!signalResult.success || !signalResult.data) {
      res.status(500).json({ success: false, error: 'Failed to load signals' })
      return
    }

    // Extract all holdings from portfolio
    const holdings: import('@prism/shared').Holding[] = []
    for (const account of portfolio.accounts) {
      for (const holding of account.holdings) {
        holdings.push(holding)
      }
    }

    // Build base context with Layer 1
    const context: import('@prism/shared').AskPrismContext = {
      page: body.page,
      sessionScope,
      entryContext: body.entryContext,
      profile,
      holdings,
      exposureMap: exposureResult.data,
      activeSignals: signalResult.data,
      contextSnapshotMeta: {
        generatedAt: new Date().toISOString(),
        activeSignalCount: signalResult.data.length,
        signalSourceSummary: signalResult.data.map((signal) => ({
          signalId: signal.id,
          sourceCount: signal.sources.length,
        })),
      },
    }

    if (body.page === 'signals_overview') {
      const netImpactResult = await runPortfolioNetImpactPipeline(pipelineContext)
      if (netImpactResult.success && netImpactResult.data) {
        signalsOverviewChain = netImpactResult.data.chain
        Object.assign(context, {
          portfolioNetImpact: {
            signalUniverseCount: netImpactResult.data.signalUniverseCount,
            includedSignalCount: netImpactResult.data.includedSignalCount,
            oneWeekImpactCad: netImpactResult.data.temporalAnalysis.timeBuckets.oneWeek.expectedDollarImpact,
            oneMonthImpactCad: netImpactResult.data.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact,
            sixMonthImpactCad: netImpactResult.data.temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact,
            topContributors: netImpactResult.data.signalContributions
              .slice(0, 5)
              .map((item) => ({
                signalId: item.signalId,
                headline: item.headline,
                normalizedWeight: item.normalizedWeight,
                oneMonthImpactCad: item.oneMonthImpactCad,
              })),
          },
        })
      }
    }

    // Layer 2: Add signal detail for signal- or node-scoped chats
    const shouldLoadSignalDetail =
      Boolean(effectiveSignalId) &&
      effectiveSignalId !== 'portfolio-net' &&
      (
        body.page === 'signal' ||
        body.page === 'plan' ||
        sessionScope.startsWith('signal:') ||
        sessionScope.startsWith('node:')
      )

    if (shouldLoadSignalDetail && effectiveSignalId) {
      const graphResult = await runGraphPipeline(pipelineContext, effectiveSignalId)
      if (!graphResult.success || !graphResult.data) {
        res.status(500).json({ success: false, error: 'Failed to load signal detail' })
        return
      }

      const { signal, chain, temporalAnalysis } = graphResult.data
      const scopedNodeId = body.entryContext?.nodeId ?? extractNodeIdFromScope(sessionScope)
      const focusedNode = scopedNodeId
        ? chain.nodes.find((node) => node.id === scopedNodeId)
        : undefined

      // Convert TemporalAnalysis to AskPrismTemporalAnalysis
      const askPrismTemporal: import('@prism/shared').AskPrismTemporalAnalysis = {
        classification: temporalAnalysis.classification,
        confidence: temporalAnalysis.confidence,
        timeBuckets: {
          oneWeek: { expectedDollarImpact: temporalAnalysis.timeBuckets.oneWeek.expectedDollarImpact },
          oneMonth: { expectedDollarImpact: temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact },
          sixMonth: { expectedDollarImpact: temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact },
        },
        counterfactual: temporalAnalysis.counterfactual,
      }

      Object.assign(context, {
        focusedSignal: signal,
        focusedNode,
        causalChain: chain,
        temporalAnalysis: askPrismTemporal,
        contextSnapshotMeta: {
          ...context.contextSnapshotMeta,
          focusedSignalDetectedAt: signal.detectedAt,
        },
      })
    } else if (signalsOverviewChain) {
      const scopedNodeId = body.entryContext?.nodeId ?? extractNodeIdFromScope(sessionScope)
      if (scopedNodeId) {
        const focusedNode = signalsOverviewChain.nodes.find((node) => node.id === scopedNodeId)
        if (focusedNode) {
          Object.assign(context, { focusedNode })
        }
      }
    }

    // Layer 3: Add plan context if on plan page
    if (body.page === 'plan') {
      // Note: Strategy candidates and evaluation would be loaded from strategy service
      // For now, just pass through planSelections if provided
      if (body.planSelections) {
        Object.assign(context, {
          currentPlan: body.planSelections,
        })
      }
    }

    // Set up SSE for streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const history = normalizeAskPrismHistory(body.history)

    for await (const chunk of streamAskPrismResponse(context, history, body.message, sessionScope)) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process request',
    })
  }
})

// ── General Chat Endpoints (Ask Prism) ─────────────────────────

// Initial message for general portfolio chat
app.post('/api/chat/:userId/general/init', async (req, res) => {
  const { userId } = req.params

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const profile = getUserProfileById(userId)
  if (!profile) {
    res.status(404).json({ success: false, error: 'User profile not found' })
    return
  }

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({ success: false, error: 'Failed to load exposure data' })
    return
  }

  const result = await generateGeneralInitialMessage(profile, exposureResult.data)
  if (result.error) {
    res.status(500).json({ success: false, error: result.error })
    return
  }

  res.json({ success: true, data: { content: result.content } })
})

// Streaming general chat response
app.post('/api/chat/:userId/general/message', async (req, res) => {
  const { userId } = req.params
  const body = req.body as { readonly history?: ReadonlyArray<AgentChatMessage>; readonly message: string }

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const profile = getUserProfileById(userId)
  if (!profile) {
    res.status(404).json({ success: false, error: 'User profile not found' })
    return
  }

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({ success: false, error: 'Failed to load exposure data' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const history: ReadonlyArray<AgentChatMessage> = body.history ?? []

  for await (const chunk of streamGeneralChatResponse(profile, exposureResult.data, history, body.message)) {
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
})

// What-if detection endpoint
app.post('/api/chat/detect-whatif', async (req, res) => {
  const { message } = req.body as { message: string }
  const result = await detectWhatIf(message)
  res.json({ success: true, data: result })
})

// ── Notification Endpoints ─────────────────────────────────

app.get('/api/notifications/:userId', (req, res) => {
  const unreadOnly = req.query.unread === 'true'
  const notifications = getNotifications(req.params.userId, { unreadOnly })
  res.json({ success: true, data: notifications })
})

app.post('/api/notifications/:userId/:id/read', (req, res) => {
  const success = markAsRead(req.params.userId, req.params.id)
  res.json({ success })
})

app.post('/api/notifications/:userId/read-all', (req, res) => {
  markAllAsRead(req.params.userId)
  res.json({ success: true })
})

app.get('/api/notifications/:userId/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send heartbeat to confirm connection
  res.write('data: {"type":"connected"}\n\n')

  const unsubscribe = subscribeSse(req.params.userId, res)

  req.on('close', () => {
    unsubscribe()
  })
})

// ── Background Signal Checker ──────────────────────────────

async function fetchSignalsForUser(userId: string): Promise<ReadonlyArray<import('@prism/shared').Signal>> {
  if (USE_ADK_ORCHESTRATION) {
    const adkResult = await runAdkSignalsPipeline(userId)
    if (adkResult.success && adkResult.data) {
      if (adkResult.data.length > 0 || ADK_EMPTY_SIGNAL_IS_VALID) {
        return adkResult.data
      }
      traceImpact('background-signals:adk-empty-fallback', { userId })
    } else {
      traceImpact('background-signals:adk-error', {
        userId,
        error: adkResult.error ?? 'Unknown ADK signals error',
      })
    }
  }

  const ctx = buildPipelineCtx(userId)
  if (!ctx) return []

  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) return []

  const signalResult = await runSignalMonitor(exposureResult.data)
  if (!signalResult.success || !signalResult.data) return []

  return signalResult.data
}

startBackgroundChecker(fetchSignalsForUser)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Prism server running on http://localhost:${port}`)
})
