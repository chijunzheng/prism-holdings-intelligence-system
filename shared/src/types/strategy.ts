import { z } from 'zod'

export const StrategySecurityType = z.enum(['etf', 'stock', 'cash'])
export type StrategySecurityType = z.infer<typeof StrategySecurityType>

export const StrategyLiquidityTier = z.enum(['high', 'medium', 'low'])
export type StrategyLiquidityTier = z.infer<typeof StrategyLiquidityTier>

export const StrategyQuoteSource = z.enum([
  'holding_implied',
  'model_estimate',
  'unavailable',
])
export type StrategyQuoteSource = z.infer<typeof StrategyQuoteSource>

export const StrategyPositionSuggestionSchema = z.object({
  targetCad: z.number().min(0),
  estimatedShares: z.number().int().nonnegative().nullable(),
  estimatedTradeCad: z.number().min(0).nullable(),
  residualCad: z.number().min(0).nullable(),
}).readonly()
export type StrategyPositionSuggestion = z.infer<typeof StrategyPositionSuggestionSchema>

export const StrategyObjective = z.enum([
  'minimize_one_month_downside_with_six_month_guardrail',
])
export type StrategyObjective = z.infer<typeof StrategyObjective>

export const StrategyCandidateSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  name: z.string(),
  type: StrategySecurityType,
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  expectedMitigationCad: z.number(),
  proposedShiftPct: z.number().min(0).max(10),
  diversificationScore: z.number().min(0).max(1),
  estimatedTurnoverCostCad: z.number().min(0),
  estimatedTaxCostCad: z.number().min(0),
  isLargeCapProxy: z.boolean().default(false),
  liquidityTier: StrategyLiquidityTier,
  rankScore: z.number(),
  referencePriceCad: z.number().positive().optional(),
  quoteSource: StrategyQuoteSource.optional(),
  quoteAsOf: z.string().datetime().optional(),
  positionSuggestion: StrategyPositionSuggestionSchema.optional(),
})
export type StrategyCandidate = z.infer<typeof StrategyCandidateSchema>

export const StrategyScenarioItemSchema = z.object({
  candidateId: z.string(),
  ticker: z.string(),
  name: z.string(),
  type: StrategySecurityType,
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  expectedMitigationCad: z.number(),
  diversificationScore: z.number().min(0).max(1),
  estimatedTurnoverCostCad: z.number().min(0),
  estimatedTaxCostCad: z.number().min(0),
  allocationPct: z.number().min(0).max(10),
})
export type StrategyScenarioItem = z.infer<typeof StrategyScenarioItemSchema>

export const StrategyScenarioSchema = z.object({
  items: z.array(StrategyScenarioItemSchema).readonly(),
})
export type StrategyScenario = z.infer<typeof StrategyScenarioSchema>

export const StrategyConstraintsSchema = z.object({
  turnoverCapPct: z.number().min(0).max(10),
  hardMaxTurnoverPct: z.number().min(0).max(10).default(10),
  allowCashBuffer: z.boolean().default(true),
  taxAware: z.boolean().default(true),
  noMicrocaps: z.boolean().default(true),
  excludeLeveragedEtfs: z.boolean().default(true),
  maxNewPositions: z.number().int().min(0).max(10).default(2),
})
export type StrategyConstraints = z.infer<typeof StrategyConstraintsSchema>

export const StrategyDraftRequestSchema = z.object({
  signalId: z.string().optional(),
  seedSummary: z.string().max(280).optional(),
  maxCandidates: z.number().int().min(1).max(10).optional(),
  explicitOverride: z.boolean().optional(),
  requestedTurnoverCapPct: z.number().min(0).max(10).optional(),
})
export type StrategyDraftRequest = z.infer<typeof StrategyDraftRequestSchema>

export const StrategyDraftSchema = z.object({
  signalId: z.string().nullable(),
  signalHeadline: z.string().nullable(),
  generatedAt: z.string().datetime(),
  objective: StrategyObjective,
  constraints: StrategyConstraintsSchema,
  candidates: z.array(StrategyCandidateSchema).readonly(),
  scenario: StrategyScenarioSchema,
  baselineOneMonthCad: z.number(),
  baselineSixMonthCad: z.number(),
  seedSummary: z.string().nullable(),
  humanDecisionRequired: z.literal(true),
})
export type StrategyDraft = z.infer<typeof StrategyDraftSchema>

export const StrategyEvaluateRequestSchema = z.object({
  signalId: z.string().optional(),
  scenario: StrategyScenarioSchema,
  explicitOverride: z.boolean().optional(),
  requestedTurnoverCapPct: z.number().min(0).max(10).optional(),
})
export type StrategyEvaluateRequest = z.infer<typeof StrategyEvaluateRequestSchema>

export const StrategyEvaluationSchema = z.object({
  generatedAt: z.string().datetime(),
  objective: StrategyObjective,
  baselineOneMonthCad: z.number(),
  proposedOneMonthCad: z.number(),
  baselineSixMonthCad: z.number(),
  proposedSixMonthCad: z.number(),
  downsideReductionCad: z.number(),
  sixMonthGuardrailDeltaCad: z.number(),
  diversificationGain: z.number(),
  turnoverPct: z.number(),
  turnoverCapPct: z.number(),
  taxPenaltyCad: z.number(),
  score: z.number(),
  objectiveSatisfied: z.boolean(),
  warnings: z.array(z.string()).readonly(),
  humanDecisionRequired: z.literal(true),
})
export type StrategyEvaluation = z.infer<typeof StrategyEvaluationSchema>
