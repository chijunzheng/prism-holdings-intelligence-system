import { z } from 'zod'

// ── Candidate (saved recommendation action) ─────────────────
export const CandidateSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ticker: z.string(),
  name: z.string(),
  action: z.enum(['reduce', 'increase', 'hold', 'add_new', 'remove']),
  suggestedChangeCad: z.number().optional(),
  suggestedChangePct: z.number().optional(),
  rationale: z.string(),
  status: z.enum(['watching', 'planned', 'dismissed']),
  sourceSignalId: z.string().optional(),
  sourceRecommendationId: z.string().optional(),
  sourceLabel: z.string(),
  createdAt: z.string(),
})
export type Candidate = z.infer<typeof CandidateSchema>

// ── Plan Preview (what-if portfolio comparison) ─────────────
export const AllocationEntrySchema = z.object({
  category: z.string(),
  pct: z.number(),
})

export const PlanPreviewSchema = z.object({
  currentAllocation: z.array(AllocationEntrySchema),
  projectedAllocation: z.array(AllocationEntrySchema),
  diversificationScoreChange: z.object({
    before: z.number(),
    after: z.number(),
  }),
  riskReductionEstimate: z.string(),
  estimatedTransactionCost: z.string(),
  candidateCount: z.number(),
})
export type PlanPreview = z.infer<typeof PlanPreviewSchema>
