import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  PortfolioSchema,
  UserProfileSchema,
  FundCompositionSchema,
  type Portfolio,
  type UserProfile,
  type FundComposition,
} from '@prism/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadJson<T>(path: string, parser: { parse: (data: unknown) => T }): T {
  const raw = JSON.parse(readFileSync(join(__dirname, path), 'utf-8'))
  return parser.parse(raw)
}

// ── Portfolios ─────────────────────────────────────────────

const PORTFOLIO_FILES = [
  'portfolios/sarah-01.json',
  'portfolios/jason-01.json',
  'portfolios/diana-01.json',
] as const

let portfolioCache: ReadonlyArray<Portfolio> | null = null

export function getPortfolios(): ReadonlyArray<Portfolio> {
  if (portfolioCache) return portfolioCache
  portfolioCache = PORTFOLIO_FILES.map((f) => loadJson(f, PortfolioSchema))
  return portfolioCache
}

export function getPortfolioByUserId(userId: string): Portfolio | undefined {
  return getPortfolios().find((p) => p.userId === userId)
}

// ── Fund Compositions ──────────────────────────────────────

const FUND_TICKERS = ['VFV', 'XIC', 'ZAG', 'ZEB', 'XEG', 'XGD', 'XQQ', 'ZDV', 'NVDA', 'TSLA', 'BTCX.B', 'RY', 'ENB'] as const

let fundCache: ReadonlyMap<string, FundComposition> | null = null

function loadFunds(): ReadonlyMap<string, FundComposition> {
  if (fundCache) return fundCache
  const entries = FUND_TICKERS.map((ticker) => {
    const fund = loadJson(`funds/${ticker}.json`, FundCompositionSchema)
    return [ticker, fund] as const
  })
  fundCache = new Map(entries)
  return fundCache
}

export function getFundComposition(ticker: string): FundComposition | undefined {
  return loadFunds().get(ticker)
}

export function getAllFundCompositions(): ReadonlyMap<string, FundComposition> {
  return loadFunds()
}

// ── User Profiles ──────────────────────────────────────────

const PROFILE_FILES = [
  'user-profiles/sarah-01.json',
  'user-profiles/jason-01.json',
  'user-profiles/diana-01.json',
] as const

let profileCache: ReadonlyArray<UserProfile> | null = null

export function getUserProfiles(): ReadonlyArray<UserProfile> {
  if (profileCache) return profileCache
  profileCache = PROFILE_FILES.map((f) => loadJson(f, UserProfileSchema))
  return profileCache
}

export function getUserProfileById(id: string): UserProfile | undefined {
  return getUserProfiles().find((p) => p.id === id)
}
