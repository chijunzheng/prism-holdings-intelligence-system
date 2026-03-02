// Analyze Routes — multi-agent pipeline endpoints with SSE streaming.
// POST /api/v2/analyze — single-signal analysis
// POST /api/v2/analyze/portfolio — portfolio review mode
// POST /api/v2/analyze/:threadId/resume — resume after checkpoint

import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { getPortfolioByUserId, getUserProfileById } from '@prism/data'
import {
  runExposureAnalysis,
  type PipelineContext,
} from '@prism/agents/src/orchestrator/index'
import { getFundComposition } from '@prism/data'
import {
  runMultiAgentAnalysis,
  runPortfolioReview,
  resumeAnalysis,
} from '@prism/agents/src/multi-agent/index'
import type { AnalysisOutcome } from '@prism/agents/src/multi-agent/index'
import {
  InMemoryCacheStore,
  verdictCacheKey,
  briefCacheKey,
  portfolioVerdictCacheKey,
  DEFAULT_VERDICT_TTL,
  DEFAULT_BRIEF_TTL,
} from '@prism/agents/src/multi-agent/cache'
import type { Signal, ExposureMap, UserExpectations } from '@prism/shared'
import { createSyntheticSignal } from '@prism/agents/src/multi-agent/synthetic-signals'
import { getThreadCtx, setThreadCtx, deleteThreadCtx } from './thread-context'

// ── Shared State ────────────────────────────────────────────

const cache = new InMemoryCacheStore()

// ── Request Schemas ─────────────────────────────────────────

const SignalBodySchema = z.object({
  id: z.string(),
  headline: z.string(),
  description: z.string(),
  affectedExposures: z.array(z.string()),
  relevanceScore: z.number(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  sentiment: z.enum(['positive', 'negative', 'mixed']),
  temporalClassification: z.enum(['transient', 'structural', 'ambiguous']),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
  detectedAt: z.string(),
  acknowledged: z.boolean(),
})

const AnalyzeRequestSchema = z.object({
  userId: z.string(),
  signal: SignalBodySchema,
  skipCheckpoints: z.boolean().optional(),
  pipelineMode: z.enum(['quick', 'guided']).optional(),
})

const PortfolioReviewRequestSchema = z.object({
  userId: z.string(),
  signals: z.array(SignalBodySchema),
})

const ResumeRequestSchema = z.object({
  humanInput: z.string(),
  inputType: z.enum(['correction', 'debate_correction', 'scenario_preference']).default('correction'),
})

// ── Helpers ─────────────────────────────────────────────────

function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

function sendSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function parseRiskReductionMagnitude(riskReduction: string): number {
  const numbers = riskReduction.match(/-?\d[\d,]*/g)
  if (!numbers || numbers.length === 0) return 0
  const value = Number(numbers[0].replace(/,/g, ''))
  return Number.isFinite(value) ? Math.abs(value) : 0
}

function assertVerdictHasCoreFields(
  verdict: Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict'],
): asserts verdict is Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict'] {
  const candidate = verdict as {
    holdingImpacts?: unknown
    recommendations?: unknown
  } | null | undefined

  if (!candidate || !Array.isArray(candidate.holdingImpacts)) {
    throw new Error('Cannot build analysis response: verdict is missing holdingImpacts.')
  }
  if (!Array.isArray(candidate.recommendations)) {
    throw new Error('Cannot build analysis response: verdict is missing recommendations.')
  }
}

function buildImpactDelta(signal: Signal, verdict: Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict']) {
  assertVerdictHasCoreFields(verdict)
  const affectedHoldings = verdict.holdingImpacts
    .map((holding) => {
      const oneMonthImpact = holding.impact['1M'] ?? holding.impact['1W'] ?? holding.impact['6M']
      return {
        ticker: holding.ticker,
        name: holding.name,
        impactMidCad: oneMonthImpact?.mid ?? 0,
        confidence: holding.confidence,
      }
    })
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
  assertVerdictHasCoreFields(verdict)
  const actionable = verdict.recommendations.filter((rec) => !rec.isDoNothing)
  const ranked = (actionable.length > 0 ? actionable : verdict.recommendations).sort((a, b) => {
    const magnitudeDiff =
      parseRiskReductionMagnitude(b.riskReduction) - parseRiskReductionMagnitude(a.riskReduction)
    if (magnitudeDiff !== 0) return magnitudeDiff
    return a.estimatedCost.localeCompare(b.estimatedCost)
  })

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
      {
        id: 'confirm-scope',
        title: `Confirm exposure scope for "${selected.title}"`,
        detail: 'Review affected holdings and align with your current cash/liquidity constraints.',
      },
      {
        id: 'execute-adjustment',
        title: 'Apply the portfolio adjustment manually',
        detail: selected.description,
      },
      {
        id: 'validate-outcome',
        title: 'Re-run analysis after execution',
        detail: 'Verify projected risk reduction against updated impacts.',
      },
    ],
    alternatives: verdict.recommendations.filter((rec) => rec.id !== selected.id),
  }
}

function buildTraceSteps(result: Awaited<ReturnType<typeof runMultiAgentAnalysis>>) {
  const steps = [
    {
      stageId: 'risk_profile',
      stageLabel: 'Risk Profile',
      summary: `Inferred ${result.intermediateArtifacts.riskProfile.riskTolerance} tolerance (${result.intermediateArtifacts.riskProfile.riskScore}/100).`,
    },
    {
      stageId: 'analyst_complete',
      stageLabel: 'Analyst Team',
      summary: `${result.intermediateArtifacts.analystAssessments.length} analyst perspectives synthesized.`,
    },
    {
      stageId: 'debate_complete',
      stageLabel: 'Bull vs Bear Debate',
      summary: `Consensus: ${result.intermediateArtifacts.debateResolution.consensusDirection} with ${Math.round(result.intermediateArtifacts.debateResolution.consensusConfidence * 100)}% confidence.`,
    },
    {
      stageId: 'risk_challenge',
      stageLabel: 'Assumption Challenges',
      summary: `${result.intermediateArtifacts.riskChallenge.challengedAssumptions.length} assumptions challenged.`,
    },
    {
      stageId: 'magnitude_validation',
      stageLabel: 'Magnitude Validation',
      summary: `${result.intermediateArtifacts.magnitudeValidation.outOfBoundsFlags.length} out-of-bounds estimates corrected.`,
    },
    {
      stageId: 'stress_complete',
      stageLabel: 'Stress Test',
      summary: `Tail-risk midpoint impact: $${Math.round(result.intermediateArtifacts.stressTest.tailRisk.mid).toLocaleString()}.`,
    },
    {
      stageId: 'verdict',
      stageLabel: 'Fund Manager Verdict',
      summary: `${result.verdict.holdingImpacts.length} holdings with calibrated impacts and recommended actions.`,
    },
  ]

  return steps
}

/** Derive UserExpectations from the user profile when none are explicitly submitted. */
function deriveExpectations(profile: ReturnType<typeof getUserProfileById>): UserExpectations | undefined {
  if (!profile) return undefined
  return {
    horizon: profile.investmentHorizonYears,
    riskToleranceOverride: profile.riskTolerance as 'low' | 'moderate' | 'high',
    goals: [...profile.goals],
  }
}

function buildPipelineContext(userId: string): PipelineContext | null {
  const portfolio = getPortfolioByUserId(userId)
  const profile = getUserProfileById(userId)
  if (!portfolio || !profile) return null
  return { portfolio, profile, getFundComposition }
}

async function getExposureMap(userId: string): Promise<ExposureMap | null> {
  const ctx = buildPipelineContext(userId)
  if (!ctx) return null

  const result = await runExposureAnalysis(ctx)
  if (!result.success || !result.data) return null
  return result.data
}

// ── Routes ──────────────────────────────────────────────────

export const analyzeRouter = Router()

// POST /api/v2/analyze — single-signal analysis with SSE streaming
analyzeRouter.post('/', async (req: Request, res: Response) => {
  const parsed = AnalyzeRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { userId, signal, skipCheckpoints = false, pipelineMode } = parsed.data

  // Determine effective mode: explicit pipelineMode takes precedence over skipCheckpoints
  const effectiveMode = pipelineMode ?? (skipCheckpoints ? 'quick' : 'guided')
  const isGuided = effectiveMode === 'guided'

  const portfolio = getPortfolioByUserId(userId)
  const userProfile = getUserProfileById(userId)
  if (!portfolio || !userProfile) {
    res.status(404).json({ success: false, error: 'User or portfolio not found' })
    return
  }

  // Check cache first (skip cache for guided mode — user wants interactive flow)
  if (!isGuided) {
    const cachedVerdict = await cache.get(verdictCacheKey(signal.id, userId))
    const cachedBrief = await cache.get(briefCacheKey(signal.id, userId))
    if (cachedVerdict && cachedBrief) {
      const typedCachedVerdict = cachedVerdict as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict']
      res.json({
        success: true,
        cached: true,
        data: {
          verdict: typedCachedVerdict,
          researchBrief: cachedBrief,
          impactDelta: buildImpactDelta(signal as Signal, typedCachedVerdict),
          playbook: buildPlaybook(signal as Signal, typedCachedVerdict),
        },
      })
      return
    }
  }

  const exposureMap = await getExposureMap(userId)
  if (!exposureMap) {
    res.status(500).json({ success: false, error: 'Failed to compute exposure map' })
    return
  }

  setupSse(res)

  try {
    const outcome = await runMultiAgentAnalysis({
      signal: signal as Signal,
      portfolio,
      exposureMap,
      userProfile,
      userExpectations: deriveExpectations(userProfile),
      skipCheckpoints: !isGuided,
      pipelineMode: effectiveMode,
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
      onThinking: (stage, text) => {
        sendSseEvent(res, 'agent_thinking', { stage, text })
      },
    }) as AnalysisOutcome

    if (isGuided && outcome.type === 'checkpoint') {
      // Store thread context for resume endpoint
      await setThreadCtx(outcome.threadId, { signal: signal as Signal, userId })
      sendSseEvent(res, 'thread_id', { threadId: outcome.threadId })
      sendSseEvent(res, 'checkpoint', outcome.checkpoint)
    } else {
      // Complete — extract result (handle both return shapes)
      const result = outcome.type === 'complete' ? outcome.result : outcome as unknown as Awaited<ReturnType<typeof runMultiAgentAnalysis>>

      // Handle MultiAgentResult shape (non-guided mode returns this directly)
      const finalResult = 'verdict' in result ? result : (result as { result: { verdict: unknown } }).result
      const verdict = finalResult.verdict as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['verdict']
      const researchBrief = finalResult.researchBrief as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['researchBrief']
      const intermediateArtifacts = finalResult.intermediateArtifacts as Awaited<ReturnType<typeof runMultiAgentAnalysis>>['intermediateArtifacts']

      // Cache results
      await cache.set(verdictCacheKey(signal.id, userId), verdict, DEFAULT_VERDICT_TTL)
      await cache.set(briefCacheKey(signal.id, userId), researchBrief, DEFAULT_BRIEF_TTL)

      // Clean up thread context if it was guided mode that completed
      if (outcome.type === 'complete' && outcome.threadId) {
        await deleteThreadCtx(outcome.threadId)
      }

      const impactDelta = buildImpactDelta(signal as Signal, verdict)
      const playbook = buildPlaybook(signal as Signal, verdict)
      const traceSteps = buildTraceSteps({ verdict, researchBrief, intermediateArtifacts })

      sendSseEvent(res, 'impact_delta', impactDelta)
      if (playbook) {
        sendSseEvent(res, 'playbook', playbook)
      }
      for (const step of traceSteps) {
        sendSseEvent(res, 'trace_step', step)
      }

      sendSseEvent(res, 'complete', {
        verdict,
        researchBrief,
        intermediateArtifacts,
        impactDelta,
      })
    }
  } catch (error) {
    console.error('[Analyze] Pipeline failed:', error instanceof Error ? error.stack : error)
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Pipeline failed',
    })
  }

  res.end()
})

// POST /api/v2/analyze/portfolio — portfolio review mode
analyzeRouter.post('/portfolio', async (req: Request, res: Response) => {
  const parsed = PortfolioReviewRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { userId, signals } = parsed.data

  const portfolio = getPortfolioByUserId(userId)
  const userProfile = getUserProfileById(userId)
  if (!portfolio || !userProfile) {
    res.status(404).json({ success: false, error: 'User or portfolio not found' })
    return
  }

  // Check cache
  const cachedPortfolioVerdict = await cache.get(portfolioVerdictCacheKey(userId))
  if (cachedPortfolioVerdict) {
    res.json({ success: true, cached: true, data: cachedPortfolioVerdict })
    return
  }

  const exposureMap = await getExposureMap(userId)
  if (!exposureMap) {
    res.status(500).json({ success: false, error: 'Failed to compute exposure map' })
    return
  }

  setupSse(res)

  try {
    const result = await runPortfolioReview({
      signals: signals as Signal[],
      portfolio,
      exposureMap,
      userProfile,
      userExpectations: deriveExpectations(userProfile),
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
    })

    await cache.set(portfolioVerdictCacheKey(userId), result, DEFAULT_VERDICT_TTL)

    sendSseEvent(res, 'complete', result)
  } catch (error) {
    console.error('[Analyze] Portfolio review failed:', error instanceof Error ? error.stack : error)
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Portfolio review failed',
    })
  }

  res.end()
})

// ── Synthetic Signal Analysis Endpoints ──────────────────

const SyntheticAnalyzeSchema = z.object({
  userId: z.string(),
})

// POST /api/v2/analyze/risk-check — portfolio risk review via synthetic signal
analyzeRouter.post('/risk-check', async (req: Request, res: Response) => {
  const parsed = SyntheticAnalyzeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { userId } = parsed.data
  const portfolio = getPortfolioByUserId(userId)
  const userProfile = getUserProfileById(userId)
  if (!portfolio || !userProfile) {
    res.status(404).json({ success: false, error: 'User or portfolio not found' })
    return
  }

  const exposureMap = await getExposureMap(userId)
  if (!exposureMap) {
    res.status(500).json({ success: false, error: 'Failed to compute exposure map' })
    return
  }

  const signal = createSyntheticSignal('risk_check', exposureMap, portfolio)

  setupSse(res)

  try {
    const result = await runMultiAgentAnalysis({
      signal,
      portfolio,
      exposureMap,
      userProfile,
      userExpectations: deriveExpectations(userProfile),
      skipCheckpoints: true,
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
      onThinking: (stage, text) => {
        sendSseEvent(res, 'agent_thinking', { stage, text })
      },
    })

    const impactDelta = buildImpactDelta(signal, result.verdict)
    const playbook = buildPlaybook(signal, result.verdict)
    const traceSteps = buildTraceSteps(result)

    sendSseEvent(res, 'impact_delta', impactDelta)
    if (playbook) sendSseEvent(res, 'playbook', playbook)
    for (const step of traceSteps) {
      sendSseEvent(res, 'trace_step', step)
    }

    sendSseEvent(res, 'complete', {
      verdict: result.verdict,
      researchBrief: result.researchBrief,
      intermediateArtifacts: result.intermediateArtifacts,
    })
  } catch (error) {
    console.error('[Analyze] Risk check pipeline failed:', error instanceof Error ? error.stack : error)
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Risk check pipeline failed',
    })
  }

  res.end()
})

// POST /api/v2/analyze/improve — portfolio improvement via synthetic signal
analyzeRouter.post('/improve', async (req: Request, res: Response) => {
  const parsed = SyntheticAnalyzeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { userId } = parsed.data
  const portfolio = getPortfolioByUserId(userId)
  const userProfile = getUserProfileById(userId)
  if (!portfolio || !userProfile) {
    res.status(404).json({ success: false, error: 'User or portfolio not found' })
    return
  }

  const exposureMap = await getExposureMap(userId)
  if (!exposureMap) {
    res.status(500).json({ success: false, error: 'Failed to compute exposure map' })
    return
  }

  const signal = createSyntheticSignal('improve_portfolio', exposureMap, portfolio)

  setupSse(res)

  try {
    const result = await runMultiAgentAnalysis({
      signal,
      portfolio,
      exposureMap,
      userProfile,
      userExpectations: deriveExpectations(userProfile),
      skipCheckpoints: true,
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
      onThinking: (stage, text) => {
        sendSseEvent(res, 'agent_thinking', { stage, text })
      },
    })

    const impactDelta = buildImpactDelta(signal, result.verdict)
    const playbook = buildPlaybook(signal, result.verdict)
    const traceSteps = buildTraceSteps(result)

    sendSseEvent(res, 'impact_delta', impactDelta)
    if (playbook) sendSseEvent(res, 'playbook', playbook)
    for (const step of traceSteps) {
      sendSseEvent(res, 'trace_step', step)
    }

    sendSseEvent(res, 'complete', {
      verdict: result.verdict,
      researchBrief: result.researchBrief,
      intermediateArtifacts: result.intermediateArtifacts,
    })
  } catch (error) {
    console.error('[Analyze] Portfolio improvement pipeline failed:', error instanceof Error ? error.stack : error)
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Portfolio improvement pipeline failed',
    })
  }

  res.end()
})

// POST /api/v2/analyze/:threadId/resume — resume after checkpoint
analyzeRouter.post('/:threadId/resume', async (req: Request, res: Response) => {
  const { threadId } = req.params
  if (!req.body || typeof req.body !== 'object') {
    console.error(`[Resume] Missing or invalid body for thread ${threadId}. Content-Type: ${req.headers['content-type']}, body:`, req.body)
    res.status(400).json({ success: false, error: 'Missing request body' })
    return
  }
  const parsed = ResumeRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    console.error(`[Resume] Validation failed for thread ${threadId}:`, parsed.error.issues, 'body:', JSON.stringify(req.body))
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { humanInput } = parsed.data

  // Retrieve stored thread context (signal + userId)
  const threadCtx = await getThreadCtx(threadId)
  if (!threadCtx) {
    res.status(404).json({ success: false, error: 'Thread not found or expired' })
    return
  }

  setupSse(res)

  try {
    const outcome = await resumeAnalysis({
      threadId,
      humanInput,
      onProgress: (stage, data) => sendSseEvent(res, stage, data),
      onThinking: (stage, text) => sendSseEvent(res, 'agent_thinking', { stage, text }),
    })

    if (outcome.type === 'checkpoint') {
      // Another checkpoint (e.g., CP2 after resuming from CP1)
      sendSseEvent(res, 'checkpoint', outcome.checkpoint)
    } else {
      // Pipeline completed — send full results
      const { result } = outcome
      const { signal, userId } = threadCtx

      if (!result.verdict) {
        throw new Error('Resume completed without a verdict. Please retry.')
      }
      if (!result.researchBrief) {
        throw new Error('Resume completed without a research brief. Please retry.')
      }

      // Cache results
      await cache.set(verdictCacheKey(signal.id, userId), result.verdict, DEFAULT_VERDICT_TTL)
      await cache.set(briefCacheKey(signal.id, userId), result.researchBrief, DEFAULT_BRIEF_TTL)

      const impactDelta = buildImpactDelta(signal, result.verdict)
      const playbook = buildPlaybook(signal, result.verdict)
      const traceSteps = buildTraceSteps(result)

      sendSseEvent(res, 'impact_delta', impactDelta)
      if (playbook) {
        sendSseEvent(res, 'playbook', playbook)
      }
      for (const step of traceSteps) {
        sendSseEvent(res, 'trace_step', step)
      }

      sendSseEvent(res, 'complete', {
        verdict: result.verdict,
        researchBrief: result.researchBrief,
        intermediateArtifacts: result.intermediateArtifacts,
        impactDelta,
      })

      // Clean up thread context
      await deleteThreadCtx(threadId)
    }
  } catch (error) {
    console.error('[Analyze] Resume failed:', error instanceof Error ? error.stack : error)
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Resume failed',
    })
  }

  res.end()
})

// Export cache for use in other routes
export { cache }
