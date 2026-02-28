// Risk Profile Inference — Pure computation, no LLM
// Infers user's actual risk tolerance from portfolio composition.
// Respects user-declared overrides when provided.

import type {
  Portfolio,
  Holding,
  InferredRiskProfile,
  RiskFactor,
  UserExpectations,
  ExposureMap,
} from '@prism/shared'

const BASE_SCORE = 50

type ScoringContext = {
  readonly totalValue: number
  readonly allHoldings: readonly Holding[]
  readonly equityPct: number
  readonly fixedIncomePct: number
  readonly commodityGoldPct: number
  readonly singleStockMaxPct: number
  readonly hasBonds: boolean
  readonly taxShelteredPct: number
  readonly concentrationWarningCount: number
  readonly horizonYears: number | undefined
  readonly accountHorizons: Record<string, number>
}

function buildScoringContext(
  portfolio: Portfolio,
  exposureMap: ExposureMap | undefined,
  userExpectations: UserExpectations | undefined,
): ScoringContext {
  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = portfolio.totalValueCad

  const equityValue = allHoldings
    .filter((h) => h.type === 'ETF' || h.type === 'STOCK')
    .reduce((sum, h) => sum + h.valueCad, 0)
  const bondValue = allHoldings
    .filter((h) => h.type === 'BOND_ETF')
    .reduce((sum, h) => sum + h.valueCad, 0)

  // Approximate commodity/gold allocation from known tickers
  const commodityTickers = new Set(['XGD', 'XEG', 'BTCX.B'])
  const commodityGoldValue = allHoldings
    .filter((h) => commodityTickers.has(h.ticker))
    .reduce((sum, h) => sum + h.valueCad, 0)

  const singleStockMaxPct =
    allHoldings.length > 0
      ? Math.max(...allHoldings.map((h) => (h.valueCad / totalValue) * 100))
      : 0

  const taxShelteredTypes = new Set(['TFSA', 'RRSP', 'FHSA', 'LIRA'])
  const taxShelteredValue = allHoldings
    .filter((h) => taxShelteredTypes.has(h.accountType))
    .reduce((sum, h) => sum + h.valueCad, 0)

  const concentrationWarningCount =
    exposureMap?.warnings.filter(
      (w) => w.severity === 'high' || w.severity === 'critical',
    ).length ?? 0

  return {
    totalValue,
    allHoldings,
    equityPct: totalValue > 0 ? (equityValue / totalValue) * 100 : 0,
    fixedIncomePct: totalValue > 0 ? (bondValue / totalValue) * 100 : 0,
    commodityGoldPct: totalValue > 0 ? (commodityGoldValue / totalValue) * 100 : 0,
    singleStockMaxPct,
    hasBonds: bondValue > 0,
    taxShelteredPct: totalValue > 0 ? (taxShelteredValue / totalValue) * 100 : 0,
    concentrationWarningCount,
    horizonYears: userExpectations?.horizon,
    accountHorizons: userExpectations?.accountHorizons ?? {},
  }
}

function computeFactors(ctx: ScoringContext): readonly RiskFactor[] {
  const factors: RiskFactor[] = []

  // Equity allocation
  if (ctx.equityPct > 95) {
    factors.push({ factor: 'Equity allocation >95%', signal: 'Very risk-seeking', scoreEffect: 25 })
  } else if (ctx.equityPct > 80) {
    factors.push({ factor: 'Equity allocation >80%', signal: 'Risk-seeking', scoreEffect: 15 })
  }

  // Fixed income
  if (ctx.fixedIncomePct > 40) {
    factors.push({ factor: 'Fixed income >40%', signal: 'Conservative', scoreEffect: -15 })
  }

  // No bonds at all (only flag if there are holdings)
  if (!ctx.hasBonds && ctx.allHoldings.length > 0) {
    factors.push({ factor: 'No bonds in portfolio', signal: 'Very aggressive', scoreEffect: 15 })
  }

  // Concentration warnings
  if (ctx.concentrationWarningCount >= 2) {
    factors.push({
      factor: `${ctx.concentrationWarningCount} high/critical concentration warnings`,
      signal: 'Implicit risk acceptance',
      scoreEffect: 10,
    })
  }

  // Investment horizon
  if (ctx.horizonYears !== undefined) {
    if (ctx.horizonYears > 20) {
      factors.push({ factor: 'Investment horizon >20y', signal: 'Can absorb volatility', scoreEffect: 10 })
    } else if (ctx.horizonYears < 10) {
      factors.push({ factor: 'Investment horizon <10y', signal: 'Needs stability', scoreEffect: -10 })
    }
  }

  // Commodity/gold
  if (ctx.commodityGoldPct > 10) {
    factors.push({ factor: 'Commodity/gold >10%', signal: 'Defensive positioning', scoreEffect: -5 })
  }

  // Tax-sheltered
  if (ctx.taxShelteredPct > 80) {
    factors.push({ factor: 'Tax-sheltered >80%', signal: 'Conservative optimization', scoreEffect: -5 })
  }

  // Single stock concentration
  if (ctx.singleStockMaxPct > 20) {
    factors.push({
      factor: `Single position >${Math.round(ctx.singleStockMaxPct)}% of portfolio`,
      signal: 'Concentrated bet',
      scoreEffect: 10,
    })
  }

  return factors
}

function detectWarnings(
  portfolio: Portfolio,
  ctx: ScoringContext,
): readonly string[] {
  const warnings: string[] = []

  // FHSA time-horizon mismatch
  const fhsaAccounts = portfolio.accounts.filter((a) => a.type === 'FHSA')
  for (const fhsa of fhsaAccounts) {
    const fhsaValue = fhsa.holdings.reduce((sum, h) => sum + h.valueCad, 0)
    const fhsaEquityPct =
      (fhsa.holdings.filter((h) => h.type !== 'BOND_ETF').reduce((sum, h) => sum + h.valueCad, 0) /
        fhsaValue) *
      100

    const fhsaHorizon = ctx.accountHorizons['FHSA'] ?? 2 // Default 2yr for FHSA

    if (fhsaEquityPct > 80 && fhsaHorizon <= 5) {
      const potentialLoss = Math.round(fhsaValue * 0.15)
      warnings.push(
        `Your $${fhsaValue.toLocaleString()} FHSA has a ${fhsaHorizon}-year horizon but ${Math.round(fhsaEquityPct)}% equity allocation. ` +
          `A 15% correction costs $${potentialLoss.toLocaleString()} from your down payment.`,
      )
    }
  }

  // Duplicate holdings across accounts
  const holdingsByTicker = new Map<string, { accounts: string[]; totalValue: number }>()
  for (const account of portfolio.accounts) {
    for (const holding of account.holdings) {
      const existing = holdingsByTicker.get(holding.ticker)
      if (existing) {
        existing.accounts.push(account.type)
        existing.totalValue += holding.valueCad
      } else {
        holdingsByTicker.set(holding.ticker, {
          accounts: [account.type],
          totalValue: holding.valueCad,
        })
      }
    }
  }

  for (const [ticker, info] of holdingsByTicker) {
    if (info.accounts.length > 1) {
      const pct = ((info.totalValue / ctx.totalValue) * 100).toFixed(1)
      warnings.push(
        `${ticker} appears in ${info.accounts.join(' + ')} — combined ${pct}% of portfolio ($${info.totalValue.toLocaleString()}).`,
      )
    }
  }

  return warnings
}

function scoreToTolerance(score: number): 'low' | 'moderate' | 'high' {
  if (score <= 33) return 'low'
  if (score <= 66) return 'moderate'
  return 'high'
}

export function inferRiskProfile(params: {
  readonly portfolio: Portfolio
  readonly exposureMap?: ExposureMap
  readonly userExpectations?: UserExpectations
}): InferredRiskProfile {
  const { portfolio, exposureMap, userExpectations } = params
  const ctx = buildScoringContext(portfolio, exposureMap, userExpectations)
  const factors = computeFactors(ctx)

  const rawScore = factors.reduce((sum, f) => sum + f.scoreEffect, BASE_SCORE)
  const riskScore = Math.max(0, Math.min(100, rawScore))
  const inferredTolerance = scoreToTolerance(riskScore)

  const declaredTolerance = userExpectations?.riskToleranceOverride
  const toleranceScores: Record<string, number> = { low: 20, moderate: 50, high: 80 }

  const mismatch =
    declaredTolerance && Math.abs(riskScore - toleranceScores[declaredTolerance]) > 25
      ? {
          detected: true,
          explanation:
            `Your portfolio suggests ${inferredTolerance} risk tolerance (score: ${riskScore}/100), ` +
            `but you've indicated ${declaredTolerance}. ` +
            factors.map((f) => `${f.factor}: ${f.signal}`).join('. ') +
            '.',
        }
      : { detected: false, explanation: '' }

  const warnings = detectWarnings(portfolio, ctx)

  const reasoning =
    `Risk score: ${riskScore}/100 (${inferredTolerance}). ` +
    `Portfolio is ${Math.round(ctx.equityPct)}% equity, ${Math.round(ctx.fixedIncomePct)}% fixed income. ` +
    (factors.length > 0
      ? `Key factors: ${factors.map((f) => `${f.factor} (${f.scoreEffect > 0 ? '+' : ''}${f.scoreEffect})`).join(', ')}.`
      : 'No significant risk factors detected.')

  return {
    riskScore,
    riskTolerance: declaredTolerance ?? inferredTolerance,
    factors: [...factors],
    reasoning,
    declaredTolerance,
    mismatch,
    warnings: [...warnings],
  }
}
