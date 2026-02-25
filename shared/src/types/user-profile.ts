import { z } from 'zod'

export const RiskTolerance = z.enum(['low', 'moderate', 'high'])
export type RiskTolerance = z.infer<typeof RiskTolerance>

export const FinancialLiteracy = z.enum(['low', 'moderate', 'high'])
export type FinancialLiteracy = z.infer<typeof FinancialLiteracy>

export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().min(18).max(100),
  riskTolerance: RiskTolerance,
  financialLiteracy: FinancialLiteracy,
  goals: z.array(z.string()).readonly(),
  /** Years until primary goal (e.g. retirement) */
  investmentHorizonYears: z.number().int().positive(),
  /** Brief backstory for demo context */
  context: z.string(),
  /** Short label for dropdown display */
  shortContext: z.string().optional(),
  preferences: z.object({
    /** Max signals per day */
    maxDailyAlerts: z.number().int().min(0).max(10).default(2),
    /** Preferred level of technical detail */
    detailLevel: z.enum(['simple', 'moderate', 'detailed']).default('moderate'),
  }),
})
export type UserProfile = z.infer<typeof UserProfileSchema>
