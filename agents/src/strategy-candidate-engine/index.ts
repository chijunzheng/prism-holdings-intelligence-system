import type {
  ExposureMap,
  FundComposition,
  Portfolio,
  Signal,
  StrategyCandidate,
  StrategyConstraints,
  StrategySecurityType,
  TemporalClassification,
} from '@prism/shared'
import type { TemporalAnalysis } from '../temporal-reasoner/types'
import { applyCandidateFilters } from './filter'
import { rankCandidates } from './rank'

interface CandidateEngineInput {
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly signal: Signal | null
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly constraints: StrategyConstraints
  readonly maxCandidates: number
  readonly getFundComposition: (ticker: string) => FundComposition | undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function signalKeywords(signal: Signal | null): ReadonlyArray<string> {
  if (!signal) return []
  const tokens = signal.affectedExposures
    .flatMap((label) => normalize(label).split(' '))
    .filter((token) => token.length > 2)
  return Array.from(new Set(tokens))
}

function holdingFundUniverse(
  portfolio: Portfolio,
  getFundComposition: (ticker: string) => FundComposition | undefined,
): ReadonlyArray<FundComposition> {
  const seen = new Set<string>()
  const funds: FundComposition[] = []

  for (const account of portfolio.accounts) {
    for (const holding of account.holdings) {
      const ticker = holding.ticker.trim().toUpperCase()
      if (seen.has(ticker)) continue
      const fund = getFundComposition(ticker)
      if (!fund) continue
      seen.add(ticker)
      funds.push(fund)
    }
  }

  // Defensive defaults to guarantee candidates even if not currently held.
  for (const fallbackTicker of ['ZAG', 'XGD', 'XIC', 'VFV', 'ZDV']) {
    const ticker = fallbackTicker.trim().toUpperCase()
    if (seen.has(ticker)) continue
    const fund = getFundComposition(ticker)
    if (!fund) continue
    seen.add(ticker)
    funds.push(fund)
  }

  return funds
}

function overlapScoreFromFund(
  fund: FundComposition,
  keywords: ReadonlyArray<string>,
): number {
  if (keywords.length === 0) return 0.35
  const matchedWeight = fund.holdings
    .filter((holding) => {
      const material = `${holding.sector} ${holding.country} ${holding.name}`.toLowerCase()
      return keywords.some((keyword) => material.includes(keyword))
    })
    .reduce((sum, holding) => sum + holding.weight, 0)
  return clamp(matchedWeight / Math.max(fund.coveragePercent, 1), 0, 1)
}

function classifyLiquidity(
  type: StrategySecurityType,
  signalOverlap: number,
): 'high' | 'medium' | 'low' {
  if (type === 'cash') return 'high'
  if (type === 'etf') return signalOverlap < 0.75 ? 'high' : 'medium'
  return signalOverlap < 0.8 ? 'high' : 'medium'
}

function temporalConfidenceMultiplier(classification: TemporalClassification | undefined): number {
  if (classification === 'structural') return 1.12
  if (classification === 'transient') return 0.94
  return 1
}

function candidateFromFund(
  fund: FundComposition,
  overlap: number,
  temporalClassification: TemporalClassification | undefined,
  turnoverCapPct: number,
): Omit<StrategyCandidate, 'rankScore'> {
  const diversificationScore = clamp(1 - overlap, 0.2, 0.95)
  const confidenceBase = 0.58 + diversificationScore * 0.22
  const confidence = clamp(
    confidenceBase * temporalConfidenceMultiplier(temporalClassification),
    0.45,
    0.92,
  )

  const expectedMitigationCad = Math.round(
    (fund.assetClass === 'fixed_income' ? 130 : fund.assetClass === 'commodity' ? 115 : 95) +
      diversificationScore * 65,
  )

  const proposedShiftPct = clamp(
    (turnoverCapPct / 6) * (0.8 + confidence * 0.5),
    0.6,
    2.8,
  )

  const estimatedTurnoverCostCad = Math.round(proposedShiftPct * 11)
  const estimatedTaxCostCad = Math.round(proposedShiftPct * 9)

  const rationaleBase =
    fund.assetClass === 'fixed_income'
      ? 'Defensive fixed-income sleeve to offset downside in risk assets.'
      : fund.assetClass === 'commodity'
        ? 'Commodity hedge path to diversify macro-policy uncertainty.'
        : 'Broad equity sleeve that lowers concentration in impacted segments.'

  return {
    id: `cand-etf-${fund.ticker.toLowerCase()}`,
    ticker: fund.ticker,
    name: fund.name,
    type: 'etf',
    rationale: `${rationaleBase}`,
    confidence,
    expectedMitigationCad,
    proposedShiftPct,
    diversificationScore,
    estimatedTurnoverCostCad,
    estimatedTaxCostCad,
    isLargeCapProxy: false,
    liquidityTier: classifyLiquidity('etf', overlap),
  }
}

function candidatesFromFundConstituents(
  fund: FundComposition,
  overlap: number,
  temporalClassification: TemporalClassification | undefined,
  turnoverCapPct: number,
): ReadonlyArray<Omit<StrategyCandidate, 'rankScore'>> {
  const diversificationScore = clamp(1 - overlap * 0.8, 0.25, 0.9)

  return fund.holdings
    .filter((holding) => Boolean(holding.ticker) && holding.weight >= 1)
    .slice(0, 4)
    .map((holding) => {
      const confidence = clamp(
        (0.5 + holding.weight / 25) * temporalConfidenceMultiplier(temporalClassification),
        0.42,
        0.85,
      )
      const proposedShiftPct = clamp((turnoverCapPct / 10) * (0.8 + confidence * 0.45), 0.5, 1.8)
      const expectedMitigationCad = Math.round(65 + holding.weight * 13 + diversificationScore * 35)

      return {
        id: `cand-stock-${holding.ticker!.toLowerCase()}`,
        ticker: holding.ticker!,
        name: holding.name,
        type: 'stock' as const,
        rationale:
          `Large-cap proxy from ${fund.ticker} constituents; used for targeted mitigation with controlled sizing.`,
        confidence,
        expectedMitigationCad,
        proposedShiftPct,
        diversificationScore,
        estimatedTurnoverCostCad: Math.round(proposedShiftPct * 13),
        estimatedTaxCostCad: Math.round(proposedShiftPct * 14),
        isLargeCapProxy: true,
        liquidityTier: classifyLiquidity('stock', overlap),
      }
    })
}

function cashCandidate(turnoverCapPct: number): Omit<StrategyCandidate, 'rankScore'> {
  const proposedShiftPct = clamp(turnoverCapPct / 5, 0.8, 2.2)
  return {
    id: 'cand-cash-buffer',
    ticker: 'CASH',
    name: 'Cash Buffer',
    type: 'cash',
    rationale: 'Preserves optionality when confidence is low or signal paths conflict.',
    confidence: 0.76,
    expectedMitigationCad: 120,
    proposedShiftPct,
    diversificationScore: 0.92,
    estimatedTurnoverCostCad: Math.round(proposedShiftPct * 3),
    estimatedTaxCostCad: Math.round(proposedShiftPct * 2),
    isLargeCapProxy: false,
    liquidityTier: 'high',
  }
}

export function generateMitigationCandidates({
  portfolio,
  signal,
  temporalAnalysis,
  constraints,
  maxCandidates,
  getFundComposition,
}: CandidateEngineInput): ReadonlyArray<StrategyCandidate> {
  const keywords = signalKeywords(signal)
  const funds = holdingFundUniverse(portfolio, getFundComposition)
  const candidates: Array<Omit<StrategyCandidate, 'rankScore'>> = []

  for (const fund of funds) {
    const overlap = overlapScoreFromFund(fund, keywords)
    candidates.push(
      candidateFromFund(
        fund,
        overlap,
        temporalAnalysis?.classification ?? signal?.temporalClassification,
        constraints.turnoverCapPct,
      ),
    )
    candidates.push(
      ...candidatesFromFundConstituents(
        fund,
        overlap,
        temporalAnalysis?.classification ?? signal?.temporalClassification,
        constraints.turnoverCapPct,
      ),
    )
  }

  candidates.push(cashCandidate(constraints.turnoverCapPct))

  const ranked = rankCandidates(candidates)
  const filtered = applyCandidateFilters(ranked, constraints)
  const limit = Math.max(1, maxCandidates)
  const selected = filtered.slice(0, limit)

  if (constraints.allowCashBuffer && !selected.some((candidate) => candidate.type === 'cash')) {
    const cash = filtered.find((candidate) => candidate.type === 'cash')
    if (cash) {
      if (selected.length >= limit) {
        selected[selected.length - 1] = cash
      } else {
        selected.push(cash)
      }
    }
  }

  return selected
}
