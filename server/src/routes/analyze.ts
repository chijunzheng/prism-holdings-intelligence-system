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
  compilePipeline,
} from '@prism/agents/src/multi-agent/index'
import {
  InMemoryCacheStore,
  verdictCacheKey,
  briefCacheKey,
  portfolioVerdictCacheKey,
  DEFAULT_VERDICT_TTL,
  DEFAULT_BRIEF_TTL,
} from '@prism/agents/src/multi-agent/cache'
import type { Signal, ExposureMap } from '@prism/shared'

// ── Shared State ────────────────────────────────────────────

const cache = new InMemoryCacheStore()

// ── Request Schemas ─────────────────────────────────────────

const AnalyzeRequestSchema = z.object({
  userId: z.string(),
  signal: z.object({
    id: z.string(),
    headline: z.string(),
    description: z.string(),
    affectedExposures: z.array(z.string()),
    relevanceScore: z.number(),
    urgency: z.enum(['low', 'moderate', 'high']),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    temporalClassification: z.enum(['structural', 'cyclical', 'event-driven']),
    sources: z.array(z.object({ title: z.string(), url: z.string() })),
    detectedAt: z.string(),
    acknowledged: z.boolean(),
  }),
  skipCheckpoints: z.boolean().optional(),
})

const PortfolioReviewRequestSchema = z.object({
  userId: z.string(),
  signals: z.array(z.object({
    id: z.string(),
    headline: z.string(),
    description: z.string(),
    affectedExposures: z.array(z.string()),
    relevanceScore: z.number(),
    urgency: z.enum(['low', 'moderate', 'high']),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    temporalClassification: z.enum(['structural', 'cyclical', 'event-driven']),
    sources: z.array(z.object({ title: z.string(), url: z.string() })),
    detectedAt: z.string(),
    acknowledged: z.boolean(),
  })),
})

const ResumeRequestSchema = z.object({
  humanInput: z.string(),
  inputType: z.enum(['debate_correction', 'scenario_preference']),
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

  const { userId, signal, skipCheckpoints = false } = parsed.data

  const portfolio = getPortfolioByUserId(userId)
  const userProfile = getUserProfileById(userId)
  if (!portfolio || !userProfile) {
    res.status(404).json({ success: false, error: 'User or portfolio not found' })
    return
  }

  // Check cache first
  const cachedVerdict = await cache.get(verdictCacheKey(signal.id, userId))
  const cachedBrief = await cache.get(briefCacheKey(signal.id, userId))
  if (cachedVerdict && cachedBrief) {
    res.json({
      success: true,
      cached: true,
      data: { verdict: cachedVerdict, researchBrief: cachedBrief },
    })
    return
  }

  const exposureMap = await getExposureMap(userId)
  if (!exposureMap) {
    res.status(500).json({ success: false, error: 'Failed to compute exposure map' })
    return
  }

  setupSse(res)

  try {
    const result = await runMultiAgentAnalysis({
      signal: signal as Signal,
      portfolio,
      exposureMap,
      userProfile,
      userExpectations: userProfile.expectations,
      skipCheckpoints,
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
    })

    // Cache results
    await cache.set(verdictCacheKey(signal.id, userId), result.verdict, DEFAULT_VERDICT_TTL)
    await cache.set(briefCacheKey(signal.id, userId), result.researchBrief, DEFAULT_BRIEF_TTL)

    sendSseEvent(res, 'complete', {
      verdict: result.verdict,
      researchBrief: result.researchBrief,
    })
  } catch (error) {
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
      userExpectations: userProfile.expectations,
      onProgress: (stage, data) => {
        sendSseEvent(res, stage, data)
      },
    })

    await cache.set(portfolioVerdictCacheKey(userId), result, DEFAULT_VERDICT_TTL)

    sendSseEvent(res, 'complete', result)
  } catch (error) {
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Portfolio review failed',
    })
  }

  res.end()
})

// POST /api/v2/analyze/:threadId/resume — resume after checkpoint
analyzeRouter.post('/:threadId/resume', async (req: Request, res: Response) => {
  const { threadId } = req.params
  const parsed = ResumeRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { humanInput } = parsed.data

  setupSse(res)

  try {
    const compiled = compilePipeline()

    // Resume from checkpoint with human input
    const result = await compiled.invoke(
      null, // Resume doesn't need new input — it reads from checkpoint
      {
        configurable: { thread_id: threadId },
      },
    )

    sendSseEvent(res, 'resumed', { threadId })
    sendSseEvent(res, 'complete', {
      verdict: result.fundManagerVerdict,
      researchBrief: result.researchBrief,
    })
  } catch (error) {
    sendSseEvent(res, 'error', {
      message: error instanceof Error ? error.message : 'Resume failed',
    })
  }

  res.end()
})

// Export cache for use in other routes
export { cache }
