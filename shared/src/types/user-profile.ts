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

// ── Holdings Consent ─────────────────────────────────────────
export const HoldingsConsentSchema = z.object({
  granted: z.boolean(),
  grantedAt: z.string().datetime().optional(),
  scope: z.enum(['current_positions']).default('current_positions'),
})
export type HoldingsConsent = z.infer<typeof HoldingsConsentSchema>

// ── User Expectations (for pipeline calibration) ─────────────
export const UserExpectationsSchema = z.object({
  /** Override inferred risk tolerance */
  riskToleranceOverride: z.enum(['low', 'moderate', 'high']).optional(),
  /** Years — may differ per account (e.g. FHSA vs RRSP) */
  horizon: z.number().int().positive().optional(),
  /** Free-text personal context */
  personalSituation: z.string().optional(),
  /** Primary investment goals */
  goals: z.array(z.string()).optional(),
  /** Specific concerns */
  concerns: z.array(z.string()).optional(),
  /** Per-account horizons for mismatch detection */
  accountHorizons: z.record(z.string(), z.number()).optional(),
})
export type UserExpectations = z.infer<typeof UserExpectationsSchema>
