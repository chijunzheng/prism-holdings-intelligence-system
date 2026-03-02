import { z } from 'zod'

// ── Correction Entry ─────────────────────────────────────────

export const CorrectionEntrySchema = z.object({
  id: z.string(),
  checkpointStage: z.string(),
  signalId: z.string(),
  originalValue: z.string(),
  correctedValue: z.string(),
  createdAt: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
  expiresAt: z.string().optional(),
})
export type CorrectionEntry = z.infer<typeof CorrectionEntrySchema>

// ── Analysis Memory Entry ────────────────────────────────────

export const AnalysisMemoryEntrySchema = z.object({
  signalId: z.string(),
  headline: z.string(),
  verdictDirection: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  oneMonthImpactMid: z.number(),
  userAction: z.enum(['pending', 'accepted', 'rejected', 'customized']),
  completedAt: z.string(),
  topHoldings: z.array(z.object({
    ticker: z.string(),
    impactMid: z.number(),
  })),
})
export type AnalysisMemoryEntry = z.infer<typeof AnalysisMemoryEntrySchema>

// ── User Assertion ───────────────────────────────────────────

export const AssertionCategory = z.enum([
  'risk_preference',
  'time_horizon',
  'life_event',
  'sector_preference',
  'constraint',
  'goal',
  'other',
])
export type AssertionCategory = z.infer<typeof AssertionCategory>

export const UserAssertionSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: AssertionCategory,
  extractedAt: z.string(),
  sourceMessageId: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
})
export type UserAssertion = z.infer<typeof UserAssertionSchema>

// ── Watched Signal ───────────────────────────────────────────

export const WatchedSignalSchema = z.object({
  signalId: z.string(),
  headline: z.string(),
  watchedAt: z.string(),
  lastCheckedAt: z.string(),
  originalSentiment: z.enum(['positive', 'negative', 'mixed']),
  originalRelevance: z.number().min(0).max(1),
  originalSourceCount: z.number().int().min(0),
})
export type WatchedSignal = z.infer<typeof WatchedSignalSchema>

// ── Personal Context (aggregate) ─────────────────────────────

export interface PersonalContext {
  readonly userId: string
  readonly corrections: readonly CorrectionEntry[]
  readonly analysisMemory: readonly AnalysisMemoryEntry[]
  readonly assertions: readonly UserAssertion[]
  readonly watchedSignals: readonly WatchedSignal[]
  readonly updatedAt: string
}
