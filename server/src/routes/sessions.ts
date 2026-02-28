// Analysis Sessions — CRUD for multi-agent analysis sessions.
// Each signal analysis creates a session tracking the pipeline state and messages.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import type {
  FundManagerVerdict,
  ResearchBrief,
  PortfolioVerdict,
} from '@prism/shared'

// ── Types ───────────────────────────────────────────────────

export type AnalysisSession = {
  readonly id: string
  readonly userId: string
  readonly type: 'signal' | 'portfolio_review' | 'holding' | 'general'
  readonly title: string
  readonly signalId?: string
  readonly status: 'pending' | 'analyzing' | 'checkpoint' | 'complete' | 'error'
  readonly messages: readonly ChatMessage[]
  readonly cachedVerdict?: FundManagerVerdict
  readonly cachedBrief?: ResearchBrief
  readonly cachedPortfolioVerdict?: PortfolioVerdict
  readonly checkpointStage?: string
  readonly createdAt: string
  readonly updatedAt: string
}

type ChatMessage = {
  readonly id: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly content: string
  readonly cardType?: string
  readonly cardData?: unknown
  readonly timestamp: string
}

// ── In-Memory Store ─────────────────────────────────────────

const sessions = new Map<string, AnalysisSession>()

const MAX_SESSIONS_PER_USER = 50

// ── Request Schemas ─────────────────────────────────────────

const CreateSessionSchema = z.object({
  type: z.enum(['signal', 'portfolio_review', 'holding', 'general']),
  title: z.string().max(200),
  signalId: z.string().optional(),
})

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  cardType: z.string().optional(),
  cardData: z.unknown().optional(),
})

const UpdateSessionSchema = z.object({
  status: z.enum(['pending', 'analyzing', 'checkpoint', 'complete', 'error']).optional(),
  title: z.string().max(200).optional(),
  checkpointStage: z.string().optional(),
})

// ── Helpers ─────────────────────────────────────────────────

function getUserSessions(userId: string): readonly AnalysisSession[] {
  return [...sessions.values()]
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// ── Routes ──────────────────────────────────────────────────

export const sessionsRouter = Router()

// GET /api/v2/sessions/:userId — list user sessions
sessionsRouter.get('/:userId', (_req: Request, res: Response) => {
  const { userId } = _req.params
  const userSessions = getUserSessions(userId)

  res.json({
    success: true,
    data: userSessions.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      signalId: s.signalId,
      status: s.status,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  })
})

// GET /api/v2/sessions/:userId/:sessionId — get session with messages
sessionsRouter.get('/:userId/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' })
    return
  }

  res.json({ success: true, data: session })
})

// POST /api/v2/sessions/:userId — create new session
sessionsRouter.post('/:userId', (req: Request, res: Response) => {
  const { userId } = req.params
  const parsed = CreateSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  // Enforce max sessions per user
  const existing = getUserSessions(userId)
  if (existing.length >= MAX_SESSIONS_PER_USER) {
    res.status(400).json({
      success: false,
      error: `Maximum ${MAX_SESSIONS_PER_USER} sessions per user`,
    })
    return
  }

  const now = new Date().toISOString()
  const session: AnalysisSession = {
    id: randomUUID(),
    userId,
    type: parsed.data.type,
    title: parsed.data.title,
    signalId: parsed.data.signalId,
    status: 'pending',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }

  sessions.set(session.id, session)
  res.status(201).json({ success: true, data: session })
})

// PATCH /api/v2/sessions/:userId/:sessionId — update session
sessionsRouter.patch('/:userId/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' })
    return
  }

  const parsed = UpdateSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const updated: AnalysisSession = {
    ...session,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
    ...(parsed.data.checkpointStage ? { checkpointStage: parsed.data.checkpointStage } : {}),
    updatedAt: new Date().toISOString(),
  }

  sessions.set(sessionId, updated)
  res.json({ success: true, data: updated })
})

// POST /api/v2/sessions/:userId/:sessionId/messages — add message to session
sessionsRouter.post('/:userId/:sessionId/messages', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' })
    return
  }

  const parsed = AddMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const message: ChatMessage = {
    id: randomUUID(),
    role: parsed.data.role,
    content: parsed.data.content,
    cardType: parsed.data.cardType,
    cardData: parsed.data.cardData,
    timestamp: new Date().toISOString(),
  }

  const updated: AnalysisSession = {
    ...session,
    messages: [...session.messages, message],
    updatedAt: new Date().toISOString(),
  }

  sessions.set(sessionId, updated)
  res.status(201).json({ success: true, data: message })
})

// DELETE /api/v2/sessions/:userId/:sessionId — delete session
sessionsRouter.delete('/:userId/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const existed = sessions.delete(sessionId)

  if (!existed) {
    res.status(404).json({ success: false, error: 'Session not found' })
    return
  }

  res.json({ success: true })
})

// Export for testing
export { sessions as _sessionsStore }
