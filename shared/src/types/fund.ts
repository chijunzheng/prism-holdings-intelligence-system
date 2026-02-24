import { z } from 'zod'

// ── Fund Composition (top holdings of an ETF) ──────────────
export const FundHoldingSchema = z.object({
  name: z.string(),
  ticker: z.string().optional(),
  weight: z.number().min(0).max(100),
  sector: z.string(),
  country: z.string(),
})
export type FundHolding = z.infer<typeof FundHoldingSchema>

export const FundCompositionSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  provider: z.string(),
  /** Asset class: equity, fixed income, commodity */
  assetClass: z.enum(['equity', 'fixed_income', 'commodity', 'mixed']),
  /** Primary market/geography */
  market: z.string(),
  holdings: z.array(FundHoldingSchema).readonly(),
  /** Total weight covered by listed holdings (top N may not sum to 100%) */
  coveragePercent: z.number().min(0).max(100),
  /** Source of composition data */
  dataSource: z.string(),
  /** ISO date of the fund fact sheet used */
  dataAsOf: z.string(),
  /** How frequently this data is typically refreshed */
  refreshFrequency: z.enum(['daily', 'monthly', 'quarterly']),
})
export type FundComposition = z.infer<typeof FundCompositionSchema>
