// Candidates Routes — in-memory watchlist/planned-changes CRUD.
// Stores recommendation actions the user wants to track or revisit.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getPortfolioByUserId } from '@prism/data'
import type { Candidate, PlanPreview } from '@prism/shared'

// ── In-Memory Store ──────────────────────────────────────

const candidates = new Map<string, Candidate>()

function getUserCandidates(userId: string): readonly Candidate[] {
  return [...candidates.values()]
    .filter((c) => c.userId === userId && c.status !== 'dismissed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Request Schemas ──────────────────────────────────────

const AddCandidateSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  action: z.enum(['reduce', 'increase', 'hold', 'add_new', 'remove']),
  suggestedChangeCad: z.number().optional(),
  suggestedChangePct: z.number().optional(),
  rationale: z.string(),
  sourceSignalId: z.string().optional(),
  sourceRecommendationId: z.string().optional(),
  sourceLabel: z.string(),
})

const UpdateCandidateSchema = z.object({
  status: z.enum(['watching', 'planned', 'dismissed']).optional(),
})

const FromRecommendationSchema = z.object({
  recommendationId: z.string(),
  sourceLabel: z.string(),
  sourceSignalId: z.string().optional(),
  actions: z.array(z.object({
    ticker: z.string(),
    name: z.string(),
    action: z.enum(['reduce', 'increase', 'hold', 'add_new', 'remove']),
    suggestedChangeCad: z.number().optional(),
    suggestedChangePct: z.number().optional(),
    rationale: z.string(),
  })),
})

// ── Routes ───────────────────────────────────────────────

export const candidatesRouter = Router()

// GET /api/v2/candidates/:userId — list user's active candidates
candidatesRouter.get('/:userId', (req: Request, res: Response) => {
  const { userId } = req.params
  res.json({ success: true, data: getUserCandidates(userId) })
})

// POST /api/v2/candidates/:userId — add one candidate
candidatesRouter.post('/:userId', (req: Request, res: Response) => {
  const { userId } = req.params
  const parsed = AddCandidateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const candidate: Candidate = {
    id: randomUUID(),
    userId,
    ...parsed.data,
    status: 'planned',
    createdAt: new Date().toISOString(),
  }

  candidates.set(candidate.id, candidate)
  res.status(201).json({ success: true, data: candidate })
})

// PATCH /api/v2/candidates/:userId/:id — update status
candidatesRouter.patch('/:userId/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = UpdateCandidateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const existing = candidates.get(id)
  if (!existing) {
    res.status(404).json({ success: false, error: 'Candidate not found' })
    return
  }

  const updated: Candidate = {
    ...existing,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
  }
  candidates.set(id, updated)
  res.json({ success: true, data: updated })
})

// DELETE /api/v2/candidates/:userId/:id — remove candidate
candidatesRouter.delete('/:userId/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const deleted = candidates.delete(id)
  res.json({ success: true, deleted })
})

// POST /api/v2/candidates/:userId/from-recommendation — bulk save from recommendation actions
candidatesRouter.post('/:userId/from-recommendation', (req: Request, res: Response) => {
  const { userId } = req.params
  const parsed = FromRecommendationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { recommendationId, sourceLabel, sourceSignalId, actions } = parsed.data
  const created: Candidate[] = []

  for (const action of actions) {
    const candidate: Candidate = {
      id: randomUUID(),
      userId,
      ticker: action.ticker,
      name: action.name,
      action: action.action,
      suggestedChangeCad: action.suggestedChangeCad,
      suggestedChangePct: action.suggestedChangePct,
      rationale: action.rationale,
      status: 'planned',
      sourceSignalId,
      sourceRecommendationId: recommendationId,
      sourceLabel,
      createdAt: new Date().toISOString(),
    }
    candidates.set(candidate.id, candidate)
    created.push(candidate)
  }

  res.status(201).json({ success: true, data: created })
})

// POST /api/v2/candidates/:userId/preview — compute plan impact preview
candidatesRouter.post('/:userId/preview', (req: Request, res: Response) => {
  const { userId } = req.params
  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const userCandidates = getUserCandidates(userId)
    .filter((c) => c.status === 'planned')

  if (userCandidates.length === 0) {
    res.status(400).json({ success: false, error: 'No planned candidates to preview' })
    return
  }

  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = portfolio.totalValueCad

  // Compute current allocation by asset type
  const currentByType = new Map<string, number>()
  for (const h of allHoldings) {
    const existing = currentByType.get(h.type) ?? 0
    currentByType.set(h.type, existing + h.valueCad)
  }

  const currentAllocation = [...currentByType.entries()].map(([category, value]) => ({
    category,
    pct: Math.round((value / totalValue) * 100),
  }))

  // Apply candidates to compute projected allocation
  let projectedTotal = totalValue
  const adjustments = new Map<string, number>()
  for (const c of userCandidates) {
    const changeCad = c.suggestedChangeCad ?? 0
    adjustments.set(c.ticker, (adjustments.get(c.ticker) ?? 0) + changeCad)
    projectedTotal += changeCad
  }

  // Compute projected allocation (simplified)
  const projectedByType = new Map(currentByType)
  for (const [ticker, change] of adjustments) {
    const holding = allHoldings.find((h) => h.ticker === ticker)
    const holdingType = holding?.type ?? 'ETF'
    const existing = projectedByType.get(holdingType) ?? 0
    projectedByType.set(holdingType, Math.max(0, existing + change))
  }

  const projectedAllocation = [...projectedByType.entries()].map(([category, value]) => ({
    category,
    pct: projectedTotal > 0 ? Math.round((value / projectedTotal) * 100) : 0,
  }))

  // Simplified diversification score: count of types with >5% allocation
  const diverseBefore = currentAllocation.filter((a) => a.pct > 5).length
  const diverseAfter = projectedAllocation.filter((a) => a.pct > 5).length

  const totalChangeCad = userCandidates.reduce(
    (sum, c) => sum + Math.abs(c.suggestedChangeCad ?? 0),
    0,
  )

  const preview: PlanPreview = {
    currentAllocation,
    projectedAllocation,
    diversificationScoreChange: {
      before: diverseBefore,
      after: diverseAfter,
    },
    riskReductionEstimate: `~$${Math.round(totalChangeCad * 0.4).toLocaleString()}`,
    estimatedTransactionCost: `~$${Math.round(totalChangeCad * 0.005 + userCandidates.length * 5).toLocaleString()}`,
    candidateCount: userCandidates.length,
  }

  res.json({ success: true, data: preview })
})
