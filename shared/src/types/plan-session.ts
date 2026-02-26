import { z } from 'zod'
import { StrategyDraftSchema, StrategyEvaluationSchema, StrategyScenarioSchema } from './strategy'

export const PlanSessionStatusSchema = z.enum(['draft', 'reviewed', 'archived'])
export type PlanSessionStatus = z.infer<typeof PlanSessionStatusSchema>

export const PlanSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  signalId: z.string(),
  signalHeadline: z.string(),
  title: z.string(),
  status: PlanSessionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  draft: StrategyDraftSchema.nullable(),
  selectedCandidateIds: z.array(z.string()).readonly(),
  scenario: StrategyScenarioSchema.nullable(),
  evaluation: StrategyEvaluationSchema.nullable(),
  affectedExposures: z.array(z.string()).readonly(),
})
export type PlanSession = z.infer<typeof PlanSessionSchema>

export const CreatePlanSessionRequestSchema = z.object({
  signalId: z.string(),
  signalHeadline: z.string(),
  title: z.string().optional(),
  affectedExposures: z.array(z.string()).readonly().optional(),
})
export type CreatePlanSessionRequest = z.infer<typeof CreatePlanSessionRequestSchema>

export const UpdatePlanSessionRequestSchema = z.object({
  status: PlanSessionStatusSchema.optional(),
  title: z.string().optional(),
  selectedCandidateIds: z.array(z.string()).readonly().optional(),
  scenario: StrategyScenarioSchema.nullable().optional(),
  evaluation: StrategyEvaluationSchema.nullable().optional(),
  draft: StrategyDraftSchema.nullable().optional(),
})
export type UpdatePlanSessionRequest = z.infer<typeof UpdatePlanSessionRequestSchema>
