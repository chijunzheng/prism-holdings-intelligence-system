import { z } from 'zod'

// ── Account Types ──────────────────────────────────────────
export const AccountType = z.enum(['TFSA', 'RRSP', 'FHSA', 'LIRA', 'NON_REGISTERED'])
export type AccountType = z.infer<typeof AccountType>

// ── Individual Holding ─────────────────────────────────────
export const HoldingSchema = z.object({
  ticker: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['ETF', 'STOCK', 'BOND_ETF', 'MUTUAL_FUND']),
  valueCad: z.number().positive(),
  units: z.number().positive(),
  accountType: AccountType,
  /** Day change in CAD (positive = gain, negative = loss) */
  dayChangeCad: z.number().optional(),
  /** Day change as percentage (e.g. 0.09 = +0.09%) */
  dayChangePct: z.number().optional(),
  /** Book value / cost basis in CAD (what the user paid) */
  bookValueCad: z.number().positive().optional(),
  /** ISO date string of when this data was last refreshed */
  dataAsOf: z.string().datetime(),
})
export type Holding = z.infer<typeof HoldingSchema>

// ── Account ────────────────────────────────────────────────
export const AccountSchema = z.object({
  id: z.string(),
  type: AccountType,
  holdings: z.array(HoldingSchema).readonly(),
})
export type Account = z.infer<typeof AccountSchema>

// ── Portfolio (all accounts for one user) ──────────────────
export const PortfolioSchema = z.object({
  userId: z.string(),
  accounts: z.array(AccountSchema).readonly(),
  totalValueCad: z.number().nonnegative(),
  lastUpdated: z.string().datetime(),
})
export type Portfolio = z.infer<typeof PortfolioSchema>
