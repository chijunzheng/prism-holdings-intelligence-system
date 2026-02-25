import express from 'express'
import cors from 'cors'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { getPortfolioByUserId, getFundComposition, getUserProfileById, getUserProfiles } from '@prism/data'
import { analyze } from '@prism/agents/src/exposure-analyzer/index'
import {
  runExposureAnalysis,
  runSignalMonitor,
  runGraphPipeline,
  clearCaches,
  type PipelineContext,
} from '@prism/agents/src/orchestrator/index'
import {
  generateInitialMessage,
  streamChatResponse,
  generateGeneralInitialMessage,
  streamGeneralChatResponse,
  detectWhatIf,
} from '@prism/agents/src/chat-agent/index'
import { buildChatContext } from '@prism/agents/src/chat-agent/context-builder'
import type { ChatMessage as AgentChatMessage } from '@prism/agents/src/chat-agent/types'
import { runPrismAdkPrompt } from '@prism/agents/src/adk/index'

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

const app = express()
const port = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

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
  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const exposureResult = await runExposureAnalysis(ctx)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({ success: false, error: exposureResult.error ?? 'Exposure analysis failed' })
    return
  }

  const signalResult = await runSignalMonitor(exposureResult.data)
  if (!signalResult.success) {
    res.status(500).json({ success: false, error: signalResult.error ?? 'Signal monitoring failed' })
    return
  }

  res.json(signalResult)
})

// Causal graph data endpoint (full orchestrated pipeline)
app.get('/api/graph/:userId/:signalId', async (req, res) => {
  const ctx = buildPipelineCtx(req.params.userId)
  if (!ctx) {
    res.status(404).json({ success: false, error: 'Portfolio or profile not found' })
    return
  }

  const signalId = decodeURIComponent(req.params.signalId)
  const result = await runGraphPipeline(ctx, signalId)

  if (!result.success || !result.data) {
    res.status(500).json({ success: false, error: result.error })
    return
  }

  res.json({ success: true, data: result.data })
})

// Clear caches (used on profile switch)
app.post('/api/cache/clear', (_req, res) => {
  clearCaches()
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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Prism server running on http://localhost:${port}`)
})
