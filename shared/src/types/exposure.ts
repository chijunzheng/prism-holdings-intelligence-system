import { z } from 'zod'

// ── Sector/Asset Exposure ──────────────────────────────────
export const ExposureEntrySchema = z.object({
  /** Category label, e.g. "Canadian Financials", "US Technology" */
  category: z.string(),
  /** Percentage of total portfolio (0-100) */
  percentage: z.number().min(0).max(100),
  /** Dollar value in CAD */
  valueCad: z.number().nonnegative(),
  /** Which holdings contribute to this exposure */
  contributingHoldings: z
    .array(
      z.object({
        ticker: z.string(),
        contribution: z.number().min(0).max(100),
      }),
    )
    .readonly(),
})
export type ExposureEntry = z.infer<typeof ExposureEntrySchema>

// ── Overlap Detection ──────────────────────────────────────
export const OverlapSchema = z.object({
  /** Underlying asset name, e.g. "Royal Bank of Canada" */
  assetName: z.string(),
  assetTicker: z.string().optional(),
  /** Total portfolio percentage from all sources */
  totalPercentage: z.number().min(0).max(100),
  /** Which ETFs/funds contain this asset */
  sources: z
    .array(
      z.object({
        fundTicker: z.string(),
        weightInFund: z.number().min(0).max(100),
      }),
    )
    .readonly(),
})
export type Overlap = z.infer<typeof OverlapSchema>

// ── Concentration Warning ──────────────────────────────────
export const ConcentrationWarningSchema = z.object({
  category: z.string(),
  percentage: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string(),
})
export type ConcentrationWarning = z.infer<typeof ConcentrationWarningSchema>

// ── Full Exposure Map (output of Exposure Analyzer) ────────
export const ExposureMapSchema = z.object({
  portfolioId: z.string(),
  generatedAt: z.string().datetime(),
  exposures: z.array(ExposureEntrySchema).readonly(),
  overlaps: z.array(OverlapSchema).readonly(),
  warnings: z.array(ConcentrationWarningSchema).readonly(),
  /** Tracks whether underlying fund data may be stale */
  dataFreshness: z.object({
    allFresh: z.boolean(),
    staleFunds: z.array(z.string()).readonly(),
  }),
})
export type ExposureMap = z.infer<typeof ExposureMapSchema>
