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
import { createGeminiChatModel } from '@prism/agents/src/utils/gemini-chat-model'
import { getGeminiFastModelName } from '@prism/agents/src/utils/env'
import {
  getSessionsByUser,
  getSession,
  setSession,
  deleteSession,
  countUserSessions,
} from '../firestore-store'

// ── Types ───────────────────────────────────────────────────

export type AnalysisSession = {
  readonly id: string
  readonly userId: string
  readonly type: 'signal' | 'portfolio_review' | 'holding' | 'general'
  readonly title: string
  readonly signalId?: string
  readonly starred?: boolean
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

// ── Constants ───────────────────────────────────────────────

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
  starred: z.boolean().optional(),
  checkpointStage: z.string().optional(),
})

// ── Routes ──────────────────────────────────────────────────

export const sessionsRouter = Router()

// GET /api/v2/sessions/:userId — list user sessions
sessionsRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId)
    const userSessions = await getSessionsByUser(userId)

    res.json({
      success: true,
      data: userSessions.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        signalId: s.signalId,
        starred: s.starred ?? false,
        status: s.status,
        messageCount: s.messages.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list sessions'
    res.status(500).json({ success: false, error: message })
  }
})

// GET /api/v2/sessions/:userId/:sessionId — get session with messages
sessionsRouter.get('/:userId/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const session = await getSession(sessionId)

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    res.json({ success: true, data: session })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get session'
    res.status(500).json({ success: false, error: message })
  }
})

// POST /api/v2/sessions/:userId — create new session
sessionsRouter.post('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId)
    const parsed = CreateSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message })
      return
    }

    // Enforce max sessions per user
    const count = await countUserSessions(userId)
    if (count >= MAX_SESSIONS_PER_USER) {
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

    await setSession(session)
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session'
    res.status(500).json({ success: false, error: message })
  }
})

// PATCH /api/v2/sessions/:userId/:sessionId — update session
sessionsRouter.patch('/:userId/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const session = await getSession(sessionId)

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
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.starred !== undefined ? { starred: parsed.data.starred } : {}),
      ...(parsed.data.checkpointStage !== undefined ? { checkpointStage: parsed.data.checkpointStage } : {}),
      updatedAt: new Date().toISOString(),
    }

    await setSession(updated)
    res.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update session'
    res.status(500).json({ success: false, error: message })
  }
})

// POST /api/v2/sessions/:userId/:sessionId/messages — add message to session
sessionsRouter.post('/:userId/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const session = await getSession(sessionId)

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    const parsed = AddMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message })
      return
    }

    const chatMessage: ChatMessage = {
      id: randomUUID(),
      role: parsed.data.role,
      content: parsed.data.content,
      cardType: parsed.data.cardType,
      cardData: parsed.data.cardData,
      timestamp: new Date().toISOString(),
    }

    const updated: AnalysisSession = {
      ...session,
      messages: [...session.messages, chatMessage],
      updatedAt: new Date().toISOString(),
    }

    await setSession(updated)
    res.status(201).json({ success: true, data: chatMessage })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add message'
    res.status(500).json({ success: false, error: message })
  }
})

// POST /api/v2/sessions/:userId/:sessionId/generate-title — LLM-generated session title
const GenerateTitleSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionType: z.enum(['signal', 'portfolio_review', 'holding', 'general']).optional(),
})

sessionsRouter.post('/:userId/:sessionId/generate-title', async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId)

  try {
    const session = await getSession(sessionId)

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    const parsed = GenerateTitleSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message })
      return
    }

    const model = createGeminiChatModel({
      model: getGeminiFastModelName(),
      temperature: 0.3,
      maxOutputTokens: 30,
    })

    const sessionType = parsed.data.sessionType ?? session.type
    const typeHint = sessionType === 'signal' ? 'a market signal analysis'
      : sessionType === 'portfolio_review' ? 'a portfolio review'
      : sessionType === 'holding' ? 'a deep dive on a specific holding'
      : 'a financial conversation'

    const response = await model.invoke([
      {
        role: 'user',
        content: `Generate a concise 3-6 word title for ${typeHint} that starts with: "${parsed.data.message}"\n\nRules:\n- Capture the specific topic (e.g. "Fed Rate Hike Impact", "NVIDIA Earnings Analysis", "Portfolio Risk Review")\n- Use title case, no quotes or trailing punctuation\n- Prefer action/topic words over generic phrases like "Discussion" or "Chat"\n- Return ONLY the title`,
      },
    ])

    const raw = String(response.content ?? '').trim().replace(/^["']|["']$/g, '')
    const title = raw.length > 0 ? raw.slice(0, 200) : session.title

    const updated: AnalysisSession = {
      ...session,
      title,
      updatedAt: new Date().toISOString(),
    }
    await setSession(updated)

    res.json({ success: true, data: { title } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Title generation failed'
    res.status(500).json({ success: false, error: message })
  }
})

// DELETE /api/v2/sessions/:userId/:sessionId — delete session
sessionsRouter.delete('/:userId/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const existed = await deleteSession(sessionId)

    if (!existed) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete session'
    res.status(500).json({ success: false, error: message })
  }
})
