// Unified Chat Router — POST /api/v2/chat
// Single endpoint that classifies user messages and dispatches to the appropriate handler:
//   route=chat → streamAskPrismResponse (text, ~2s)
//   route=pipeline → runMultiAgentAnalysis (full, ~30s)
//   route=portfolio_review → runPortfolioReview (parallel, ~60s)

import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { getPortfolioByUserId, getUserProfileById, getFundComposition } from '@prism/data'
import { enrichPortfolioWithLiveQuotes } from '../live-quotes'
import {
  runExposureAnalysis,
  runSignalMonitor,
  type PipelineContext,
} from '@prism/agents/src/orchestrator/index'
import {
  streamAskPrismResponse,
} from '@prism/agents/src/chat-agent/index'
import {
  runMultiAgentAnalysis,
  runPortfolioReview,
} from '@prism/agents/src/multi-agent/index'
import {
  createSyntheticSignal,
  createStockExploreSignal,
} from '@prism/agents/src/multi-agent/synthetic-signals'
import {
  createNaturalLanguageSignal,
} from '@prism/agents/src/multi-agent/synthetic-signals'
import {
  routeUserMessage,
  routeUserMessageFast,
  addAnalysisMemory,
  extractAssertions,
  addAssertion,
  formatContextForPrompt,
  hasRecentAnalysis,
  getLatestAnalysisMemory,
} from '@prism/agents/src/router/index'
import { understandQuery } from '@prism/agents/src/router/query-understanding'
import { buildAskPrismPrompt } from '@prism/agents/src/chat-agent/ask-prism-prompt'
import { parseStructuredResponse } from '../structured-response-parser'
import { threadContextMap } from './thread-context'
import type { AnalysisOutcome } from '@prism/agents/src/multi-agent/index'
import type { Signal, ExposureMap, RouterIntent, AskPrismContext } from '@prism/shared'

// ── Request Schema ───────────────────────────────────────────

const ChatRequestSchema = z.object({
  userId: z.string(),
  sessionId: z.string().optional(),
  message: z.string().min(1),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
})

// ── SSE Helpers ──────────────────────────────────────────────

function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

function sendSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// ── Data Loading ─────────────────────────────────────────────

async function buildPipelineContext(userId: string): Promise<PipelineContext | null> {
  const portfolio = getPortfolioByUserId(userId)
  const profile = getUserProfileById(userId)
  if (!portfolio || !profile) return null
  const livePortfolio = await enrichPortfolioWithLiveQuotes(portfolio)
  return { portfolio: livePortfolio, profile, getFundComposition }
}

async function getExposureMap(userId: string): Promise<ExposureMap | null> {
  const ctx = await buildPipelineContext(userId)
  if (!ctx) return null
  const result = await runExposureAnalysis(ctx)
  if (!result.success || !result.data) return null
  return result.data
}

async function getActiveSignals(exposureMap: ExposureMap): Promise<readonly Signal[]> {
  const result = await runSignalMonitor(exposureMap)
  if (!result.success || !result.data) return []
  return result.data
}

// ── Signal Prewarmer ──────────────────────────────────────────
// Proactively refreshes the signal cache before it expires (15-min TTL)
// so user requests always hit a warm cache, avoiding 3-8s cold-start spikes.

const SIGNAL_PREWARM_INTERVAL_MS = 12 * 60 * 1000 // 12 minutes (before 15-min TTL)
const PREWARMER_MAX_AGE_MS = 4 * 60 * 60 * 1000 // Auto-cleanup after 4h of inactivity

type PrewarmerEntry = {
  readonly intervalId: ReturnType<typeof setInterval>
  lastRefreshed: number
}

const prewarmingUsers = new Map<string, PrewarmerEntry>()

function startSignalPrewarmer(userId: string): void {
  const existing = prewarmingUsers.get(userId)
  if (existing) {
    // User is active — refresh the timestamp
    existing.lastRefreshed = Date.now()
    return
  }

  const warm = async () => {
    const entry = prewarmingUsers.get(userId)
    if (entry && Date.now() - entry.lastRefreshed > PREWARMER_MAX_AGE_MS) {
      // User has been inactive — clean up
      clearInterval(entry.intervalId)
      prewarmingUsers.delete(userId)
      return
    }

    try {
      const exposureMap = await getExposureMap(userId)
      if (exposureMap) {
        await getActiveSignals(exposureMap)
      }
    } catch {
      // Best-effort — never crash on background prewarming
    }
  }

  // Don't warm immediately — the current request already triggers it
  const intervalId = setInterval(() => { warm().catch(() => {}) }, SIGNAL_PREWARM_INTERVAL_MS)
  prewarmingUsers.set(userId, { intervalId, lastRefreshed: Date.now() })
}

// ── Impact Delta Builder (shared with analyze routes) ────────

function buildImpactDelta(signal: Signal, verdict: Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict']) {
  const affectedHoldings = verdict.holdingImpacts
    .map((holding) => ({
      ticker: holding.ticker,
      name: holding.name,
      impactMidCad: holding.impact['1M']?.mid ?? holding.impact['1W']?.mid ?? holding.impact['6M']?.mid ?? 0,
      confidence: holding.confidence,
    }))
    .sort((a, b) => Math.abs(b.impactMidCad) - Math.abs(a.impactMidCad))

  const netImpactMidCad = affectedHoldings.reduce((sum, item) => sum + item.impactMidCad, 0)

  return {
    signalId: signal.id,
    signalHeadline: signal.headline,
    summary: `Projected 1M net impact: $${Math.round(netImpactMidCad).toLocaleString()} across top affected holdings.`,
    netImpactMidCad,
    affectedHoldings: affectedHoldings.slice(0, 5),
  }
}

function buildPlaybook(signal: Signal, verdict: Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict']) {
  const actionable = verdict.recommendations.filter((rec) => !rec.isDoNothing)
  const ranked = (actionable.length > 0 ? actionable : verdict.recommendations)
    .sort((a, b) => a.estimatedCost.localeCompare(b.estimatedCost))
  const selected = ranked[0]
  if (!selected) return null

  return {
    signalId: signal.id,
    recommendationId: selected.id,
    title: selected.title,
    rationale: selected.description,
    estimatedCost: selected.estimatedCost,
    riskReduction: selected.riskReduction,
    tradeoffs: selected.tradeoffs,
    steps: [
      { id: 'confirm-scope', title: `Confirm exposure scope for "${selected.title}"`, detail: 'Review affected holdings.' },
      { id: 'execute-adjustment', title: 'Apply the portfolio adjustment manually', detail: selected.description },
      { id: 'validate-outcome', title: 'Re-run analysis after execution', detail: 'Verify projected risk reduction.' },
    ],
    alternatives: verdict.recommendations.filter((rec) => rec.id !== selected.id),
  }
}

// ── Route Handlers ───────────────────────────────────────────

async function handleChatRoute(
  res: Response,
  userId: string,
  message: string,
  history: readonly { role: string; content: string }[],
  personalContextPrompt: string,
  portfolio: NonNullable<ReturnType<typeof getPortfolioByUserId>>,
  userProfile: NonNullable<ReturnType<typeof getUserProfileById>>,
  exposureMap: ExposureMap,
  activeSignals: readonly Signal[],
): Promise<void> {
  const holdings = portfolio.accounts.flatMap((a) => a.holdings)

  const context: AskPrismContext = {
    page: 'portfolio',
    sessionScope: 'global',
    profile: userProfile,
    holdings,
    exposureMap,
    activeSignals: [...activeSignals],
    contextSnapshotMeta: {
      generatedAt: new Date().toISOString(),
      activeSignalCount: activeSignals.length,
      signalSourceSummary: activeSignals.map((s) => ({
        signalId: s.id,
        sourceCount: s.sources.length,
      })),
    },
  }

  const normalizedHistory = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Stream Ask Prism response — thinking tokens and text chunks are tagged separately
  let fullText = ''
  let thinkingText = ''
  for await (const chunk of streamAskPrismResponse(context, normalizedHistory, message, 'portfolio', personalContextPrompt)) {
    if (chunk.kind === 'thinking') {
      thinkingText += chunk.text
      sendSseEvent(res, 'chat_thinking', { text: chunk.text })
    } else {
      fullText += chunk.text
      sendSseEvent(res, 'chat_chunk', { text: chunk.text })
    }
  }

  // After streaming completes, check if the full response was structured JSON
  const parsed = parseStructuredResponse(fullText)
  if (parsed.kind === 'structured') {
    sendSseEvent(res, 'chat_structured', { structured: parsed.data, thinkingText: thinkingText || undefined })
  } else {
    // Send cleaned text (without >> suggestion lines) to replace the streamed text,
    // plus extracted suggestions as chips
    if (parsed.text !== fullText || parsed.suggestions.length > 0) {
      sendSseEvent(res, 'chat_chunk', {
        ...(parsed.text !== fullText ? { replaceText: parsed.text } : {}),
        ...(parsed.suggestions.length > 0 ? { suggestions: [...parsed.suggestions] } : {}),
      })
    }
  }

  sendSseEvent(res, 'chat_complete', {})
}

async function handlePipelineRoute(
  res: Response,
  userId: string,
  intent: RouterIntent,
  activeSignals: readonly Signal[],
  exposureMap: ExposureMap,
  personalContextPrompt: string,
  message: string,
  portfolio: NonNullable<ReturnType<typeof getPortfolioByUserId>>,
  userProfile: NonNullable<ReturnType<typeof getUserProfileById>>,
): Promise<void> {

  // Build signal based on pipeline mode
  let signal: Signal

  switch (intent.pipelineMode) {
    case 'existing_signal': {
      const matched = activeSignals.find((s) => s.id === intent.matchedSignalId)
      if (matched) {
        signal = matched as Signal
      } else {
        // LLM hallucinated a signal ID — fall back to natural language signal
        console.warn(`[Pipeline] matchedSignalId "${intent.matchedSignalId}" not found in ${activeSignals.length} active signals — falling back to natural language signal`)
        signal = createNaturalLanguageSignal(message, portfolio, exposureMap)
      }
      break
    }
    case 'risk_check':
      signal = createSyntheticSignal('risk_check', exposureMap, portfolio)
      break
    case 'improve_portfolio':
      signal = createSyntheticSignal('improve_portfolio', exposureMap, portfolio)
      break
    case 'explore_ticker':
      if (!intent.extractedTicker) {
        sendSseEvent(res, 'error', { message: 'No ticker extracted for explore mode' })
        return
      }
      signal = createStockExploreSignal(intent.extractedTicker, portfolio, exposureMap)
      break
    case 'new_event':
    default:
      signal = createNaturalLanguageSignal(message, portfolio, exposureMap)
      break
  }

  // Inject personal context via userExpectations.personalSituation
  const userExpectations = {
    ...userProfile.expectations,
    personalSituation: [
      userProfile.expectations?.personalSituation ?? '',
      personalContextPrompt,
    ].filter(Boolean).join('\n\n'),
  }

  try {
    const outcome = await runMultiAgentAnalysis({
      signal,
      portfolio,
      exposureMap,
      userProfile,
      userExpectations,
      skipCheckpoints: false,
      pipelineMode: 'guided',
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
      onThinking: (stage, text) => {
        sendSseEvent(res, 'agent_thinking', { stage, text })
      },
    }) as AnalysisOutcome

    if (outcome.type === 'checkpoint') {
      // Pipeline paused at a checkpoint — store context for resume
      threadContextMap.set(outcome.threadId, { signal, userId })
      sendSseEvent(res, 'thread_id', { threadId: outcome.threadId })
      sendSseEvent(res, 'checkpoint', outcome.checkpoint)
    } else {
      // Pipeline complete — extract result
      const result = outcome.type === 'complete' ? outcome.result : outcome as unknown as Awaited<ReturnType<typeof runMultiAgentAnalysis>>
      const finalResult = 'verdict' in result ? result : (result as { result: { verdict: unknown } }).result
      const verdict = finalResult.verdict as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict']
      const researchBrief = finalResult.researchBrief as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['researchBrief']
      const intermediateArtifacts = finalResult.intermediateArtifacts as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['intermediateArtifacts']

      // Clean up thread context
      if (outcome.type === 'complete' && outcome.threadId) {
        threadContextMap.delete(outcome.threadId)
      }

      const impactDelta = buildImpactDelta(signal, verdict)
      const playbook = buildPlaybook(signal, verdict)

      sendSseEvent(res, 'impact_delta', impactDelta)
      if (playbook) sendSseEvent(res, 'playbook', playbook)

      sendSseEvent(res, 'complete', {
        verdict,
        researchBrief,
        intermediateArtifacts,
      })

      // Auto-populate analysis memory (non-blocking)
      addAnalysisMemory(userId, signal, verdict, 'pending')
    }
  } catch (error) {
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Pipeline failed',
    })
  }
}

async function handlePortfolioReviewRoute(
  res: Response,
  userId: string,
  activeSignals: readonly Signal[],
  exposureMap: ExposureMap,
  personalContextPrompt: string,
  portfolio: NonNullable<ReturnType<typeof getPortfolioByUserId>>,
  userProfile: NonNullable<ReturnType<typeof getUserProfileById>>,
): Promise<void> {

  if (activeSignals.length === 0) {
    sendSseEvent(res, 'error', { message: 'No active signals to review' })
    return
  }

  const userExpectations = {
    ...userProfile.expectations,
    personalSituation: [
      userProfile.expectations?.personalSituation ?? '',
      personalContextPrompt,
    ].filter(Boolean).join('\n\n'),
  }

  try {
    const result = await runPortfolioReview({
      signals: [...activeSignals],
      portfolio,
      exposureMap,
      userProfile,
      userExpectations,
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
    })

    sendSseEvent(res, 'complete', result)
  } catch (error) {
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Portfolio review failed',
    })
  }
}

// ── Route ────────────────────────────────────────────────────

export const chatRouter = Router()

chatRouter.post('/', async (req: Request, res: Response) => {
  const parsed = ChatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { userId, message, history = [] } = parsed.data

  // 1. IMMEDIATE: Set up SSE and send routing indicator (<10ms to first byte)
  setupSse(res)
  sendSseEvent(res, 'agent_thinking', { stage: 'routing', text: 'Understanding your message...' })

  // 2. Load portfolio + exposure (always needed, fast)
  const rawPortfolio = getPortfolioByUserId(userId)
  const userProfile = getUserProfileById(userId)
  if (!rawPortfolio || !userProfile) {
    sendSseEvent(res, 'error', { message: 'User or portfolio not found' })
    res.end()
    return
  }
  const portfolio = await enrichPortfolioWithLiveQuotes(rawPortfolio)

  const exposureMap = await getExposureMap(userId)
  if (!exposureMap) {
    sendSseEvent(res, 'error', { message: 'Failed to compute exposure map' })
    res.end()
    return
  }

  // Start background signal prewarmer on first request per user
  startSignalPrewarmer(userId)

  // 3. Fast routing: greetings + ticker extraction only (~0ms)
  const fastResult = routeUserMessageFast({ userId, message })

  if (fastResult && fastResult.intent.route === 'chat') {
    sendSseEvent(res, 'route_decision', {
      route: fastResult.intent.route,
      pipelineMode: fastResult.intent.pipelineMode,
      confidence: fastResult.intent.confidence,
    })
    await handleChatRoute(res, userId, message, history, fastResult.personalContextPrompt, portfolio, userProfile, exposureMap, [])
    extractAssertions(message).then((assertions) => {
      for (const assertion of assertions) addAssertion(userId, assertion)
    }).catch(() => {})
    res.end()
    return
  }

  // 4. Parallel: signal fetch + LLM classification (follow-up aware)
  const personalContextPrompt = formatContextForPrompt(userId)
  const recentAnalysis = hasRecentAnalysis(userId)

  const [activeSignals, llmResult] = await Promise.all([
    getActiveSignals(exposureMap),
    understandQuery({
      message,
      recentMessages: history,
      personalContextSummary: personalContextPrompt.slice(0, 200),
      hasRecentAnalysis: recentAnalysis,
      activeSignals: [],
    }),
  ])

  // Log routing decision for observability
  console.log(`[Router] LLM classification: route=${llmResult.route}, confidence=${llmResult.confidence}, mode=${llmResult.pipelineMode ?? 'n/a'}, reasoning=${llmResult.reasoning?.slice(0, 80)}`)

  // If LLM says chat with decent confidence, short-circuit (skip full routing)
  if (llmResult.route === 'chat' && llmResult.confidence >= 0.6) {
    sendSseEvent(res, 'route_decision', { route: 'chat', confidence: llmResult.confidence })
    // Append latest verdict context so chat agent can reference analysis results
    const latestMemory = getLatestAnalysisMemory(userId)
    const enrichedContext = latestMemory
      ? `${personalContextPrompt}\n\n### Latest Analysis Result\nSignal: "${latestMemory.headline}" → ${latestMemory.verdictDirection}, 1M impact: $${latestMemory.oneMonthImpactMid.toLocaleString()}`
      : personalContextPrompt
    await handleChatRoute(res, userId, message, history, enrichedContext, portfolio, userProfile, exposureMap, activeSignals)
    extractAssertions(message).then((assertions) => {
      for (const assertion of assertions) addAssertion(userId, assertion)
    }).catch(() => {})
    res.end()
    return
  }

  // 5. Full routing — use query understanding result (now with signals for signal matching)
  // Only trust matchedSignalId if it actually exists in active signals (LLMs can hallucinate IDs)
  const signalIdValid = llmResult.matchedSignalId && activeSignals.some((s) => s.id === llmResult.matchedSignalId)
  const routerResult = signalIdValid
    ? { intent: llmResult, personalContextPrompt }
    : await routeUserMessage({ userId, message, activeSignals, recentMessages: history })

  // 6. Send route decision and dispatch
  sendSseEvent(res, 'route_decision', {
    route: routerResult.intent.route,
    pipelineMode: routerResult.intent.pipelineMode,
    confidence: routerResult.intent.confidence,
  })

  switch (routerResult.intent.route) {
    case 'chat':
      await handleChatRoute(res, userId, message, history, routerResult.personalContextPrompt, portfolio, userProfile, exposureMap, activeSignals)
      break
    case 'pipeline':
      await handlePipelineRoute(
        res, userId, routerResult.intent, activeSignals, exposureMap,
        routerResult.personalContextPrompt, message, portfolio, userProfile,
      )
      break
    case 'portfolio_review':
      await handlePortfolioReviewRoute(
        res, userId, activeSignals, exposureMap, routerResult.personalContextPrompt, portfolio, userProfile,
      )
      break
  }

  // 7. Background assertion extraction (best-effort, non-blocking)
  extractAssertions(message).then((assertions) => {
    for (const assertion of assertions) {
      addAssertion(userId, assertion)
    }
  }).catch(() => {})

  res.end()
})
