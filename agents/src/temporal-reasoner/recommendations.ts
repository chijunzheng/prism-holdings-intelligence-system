import type {
  ImpactDirection,
  Recommendation,
  RecommendationInputs,
  TensionAnalysis,
} from './types'

interface AssetImpact {
  readonly label: string
  readonly ticker: string
  readonly impact: number
}

type RecommendationHorizon = Recommendation['horizon']

function formatCadAbs(value: number): string {
  return `$${Math.abs(Math.round(value)).toLocaleString('en-CA')}`
}

function formatCadSigned(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded >= 0 ? '+' : '-'
  return `${sign}${formatCadAbs(rounded)}`
}

function clampShift(value: number, min = 75): number {
  if (value <= 0) return 0
  return Math.max(min, Math.round(value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function primaryGoal(inputs: RecommendationInputs): string {
  return inputs.profile.goals[0] ?? 'long-term financial objective'
}

function riskScale(inputs: RecommendationInputs): number {
  if (inputs.profile.riskTolerance === 'low') return 0.8
  if (inputs.profile.riskTolerance === 'high') return 1.2
  return 1
}

function riskCapScale(inputs: RecommendationInputs): number {
  if (inputs.profile.riskTolerance === 'low') return 0.75
  if (inputs.profile.riskTolerance === 'high') return 1.25
  return 1
}

function maxSingleNameWeight(inputs: RecommendationInputs): number {
  if (inputs.profile.riskTolerance === 'low') return 0.08
  if (inputs.profile.riskTolerance === 'high') return 0.18
  return 0.12
}

function diversificationSleeve(inputs: RecommendationInputs): string {
  if (inputs.profile.riskTolerance === 'low') {
    return 'short-duration bonds and broad-market ETFs'
  }
  if (inputs.profile.riskTolerance === 'high') {
    return 'broad-market and non-correlated growth sleeves'
  }
  return 'diversified core holdings'
}

function impactedAssets(inputs: RecommendationInputs): ReadonlyArray<AssetImpact> {
  const impacts = inputs.context.impactClassifications
    .map((entry) => {
      const ticker = entry.ticker?.trim() || entry.assetLabel.trim() || 'core holding'
      return {
        label: entry.assetLabel || ticker,
        ticker,
        impact: entry.dollarImpact,
      }
    })
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))

  if (impacts.length > 0) return impacts

  return [{ label: 'Core Holding', ticker: 'core holding', impact: 250 }]
}

function pickAssetByDirection(
  inputs: RecommendationInputs,
  direction: ImpactDirection,
): AssetImpact {
  const assets = impactedAssets(inputs)

  if (direction === 'positive') {
    const positive = assets
      .filter((asset) => asset.impact > 0)
      .sort((a, b) => b.impact - a.impact)[0]
    if (positive) return positive
  }

  if (direction === 'negative') {
    const negative = assets
      .filter((asset) => asset.impact < 0)
      .sort((a, b) => a.impact - b.impact)[0]
    if (negative) return negative
  }

  return assets[0]
}

function portfolioCapPercent(horizon: RecommendationHorizon): number {
  if (horizon === 'one_week') return 0.006
  if (horizon === 'one_month') return 0.01
  return 0.016
}

function horizonAbsoluteCap(horizon: RecommendationHorizon): { readonly min: number; readonly max: number } {
  if (horizon === 'one_week') return { min: 250, max: 1800 }
  if (horizon === 'one_month') return { min: 400, max: 3200 }
  return { min: 700, max: 5500 }
}

function expectedImpactMultiplier(horizon: RecommendationHorizon): number {
  if (horizon === 'one_week') return 0.65
  if (horizon === 'one_month') return 0.95
  return 1.25
}

function riskAdjustedPortfolioCap(
  inputs: RecommendationInputs,
  horizon: RecommendationHorizon,
): number {
  const absoluteCap = horizonAbsoluteCap(horizon)
  const pctCapRaw = inputs.totalPortfolioValueCad * portfolioCapPercent(horizon) * riskCapScale(inputs)
  return clamp(pctCapRaw, absoluteCap.min, absoluteCap.max)
}

function expectedImpactCap(
  inputs: RecommendationInputs,
  horizon: RecommendationHorizon,
  expectedImpactCad: number,
  direction: ImpactDirection,
): number {
  const baseline = Math.abs(expectedImpactCad) * expectedImpactMultiplier(horizon)
  let cap = Math.max(150, baseline)

  // One-off/transient upside should be sized more cautiously than downside defense.
  if (direction === 'positive' && inputs.context.classification === 'transient') {
    cap *= 0.6
  }
  if (direction === 'positive' && inputs.context.hasCompetingEffects) {
    cap *= 0.8
  }

  return cap
}

function concentrationCapacityCap(
  inputs: RecommendationInputs,
  horizon: RecommendationHorizon,
  direction: ImpactDirection,
  ticker: string,
): number {
  if (direction !== 'positive') return Number.POSITIVE_INFINITY
  const map = inputs.holdingWeightsByTicker
  if (!map) return Number.POSITIVE_INFINITY

  const key = ticker.trim().toUpperCase()
  const currentWeight = map[key] ?? 0
  const remainingWeight = maxSingleNameWeight(inputs) - currentWeight
  if (remainingWeight <= 0) return 0

  const horizonRamp = horizon === 'one_week' ? 0.55 : horizon === 'one_month' ? 0.75 : 1
  return inputs.totalPortfolioValueCad * remainingWeight * horizonRamp
}

function computeShift(
  inputs: RecommendationInputs,
  assetTicker: string,
  assetImpact: number,
  direction: ImpactDirection,
  expectedImpactCad: number,
  horizon: RecommendationHorizon,
  horizonScale: number,
): number {
  let rawShift = Math.abs(assetImpact) * horizonScale * riskScale(inputs)
  if (direction === 'positive' && inputs.context.classification === 'transient') {
    rawShift *= 0.7
  }
  if (direction === 'positive' && inputs.context.hasCompetingEffects) {
    rawShift *= 0.85
  }

  const cappedShift = Math.min(
    rawShift,
    riskAdjustedPortfolioCap(inputs, horizon),
    expectedImpactCap(inputs, horizon, expectedImpactCad, direction),
    concentrationCapacityCap(inputs, horizon, direction, assetTicker),
  )
  return clampShift(cappedShift)
}

function shortTermRecommendation(inputs: RecommendationInputs): Recommendation {
  const asset = pickAssetByDirection(inputs, inputs.oneWeekDirection)
  const shift = computeShift(
    inputs,
    asset.ticker,
    asset.impact,
    inputs.oneWeekDirection,
    inputs.oneWeekExpectedImpactCad,
    'one_week',
    0.34,
  )
  const oneWeekExpected = formatCadSigned(inputs.oneWeekExpectedImpactCad)

  if (inputs.oneWeekDirection === 'negative') {
    return {
      id: 'rec-short-term',
      horizon: 'one_week',
      summary: `Trim ${formatCadAbs(shift)} from ${asset.ticker} over the next week.`,
      rationale: `1-week modeled portfolio effect is ${oneWeekExpected}. For age ${inputs.profile.age} and ${inputs.profile.riskTolerance} risk tolerance, this reduces near-term downside while protecting "${primaryGoal(inputs)}".`,
      tradeoffs:
        'Lowers drawdown risk if weakness persists, but can underperform if sentiment reverses quickly.',
      proposedShiftCad: -shift,
    }
  }

  if (inputs.oneWeekDirection === 'positive') {
    if (shift <= 0) {
      return {
        id: 'rec-short-term',
        horizon: 'one_week',
        summary: `Hold ${asset.ticker}; current position is already at the concentration cap for this horizon.`,
        rationale: `1-week modeled portfolio effect is ${oneWeekExpected}, but additional sizing would breach single-name risk limits for a ${inputs.profile.riskTolerance}-risk profile.`,
        tradeoffs:
          'Maintains upside participation without raising concentration, but may underperform a larger tactical add.',
        proposedShiftCad: 0,
      }
    }
    return {
      id: 'rec-short-term',
      horizon: 'one_week',
      summary: `Add ${formatCadAbs(shift)} to ${asset.ticker} in staged buys over the next week.`,
      rationale: `1-week modeled portfolio effect is ${oneWeekExpected}. Staging entries keeps upside participation while limiting timing risk for a ${inputs.profile.riskTolerance}-risk profile.`,
      tradeoffs:
        'Captures upside if transmission holds, but increases concentration if the thesis breaks.',
      proposedShiftCad: shift,
    }
  }

  return {
    id: 'rec-short-term',
    horizon: 'one_week',
    summary: `Hold ${asset.ticker} this week; wait for clearer confirmation before resizing.`,
    rationale: `1-week modeled portfolio effect is ${oneWeekExpected}, which is mixed. Preserving optionality is more valuable than forcing a trade.`,
    tradeoffs:
      'Avoids churn in noisy conditions, but may respond later if momentum accelerates.',
    proposedShiftCad: 0,
  }
}

function mediumTermRecommendation(inputs: RecommendationInputs): Recommendation {
  const hasDirectionalTension =
    inputs.oneWeekDirection !== 'ambiguous' &&
    inputs.sixMonthDirection !== 'ambiguous' &&
    inputs.oneWeekDirection !== inputs.sixMonthDirection

  const oneWeekExpected = formatCadSigned(inputs.oneWeekExpectedImpactCad)
  const sixMonthExpected = formatCadSigned(inputs.sixMonthExpectedImpactCad)

  if (hasDirectionalTension) {
    if (inputs.oneWeekDirection === 'negative' && inputs.sixMonthDirection === 'positive') {
      const riskAsset = pickAssetByDirection(inputs, 'negative')
      const recoveryAsset = pickAssetByDirection(inputs, 'positive')
      const shift = computeShift(
        inputs,
        riskAsset.ticker,
        Math.max(Math.abs(riskAsset.impact), Math.abs(recoveryAsset.impact)),
        'ambiguous',
        inputs.oneWeekExpectedImpactCad,
        'one_month',
        0.28,
      )

      return {
        id: 'rec-medium-term',
        horizon: 'one_month',
        summary: `At the 1-month checkpoint, rotate ${formatCadAbs(shift)} from ${riskAsset.ticker} into ${recoveryAsset.ticker} only if both paths remain confirmed.`,
        rationale: `Near-term model is ${oneWeekExpected} while 6-month model is ${sixMonthExpected}. This conditional switch handles horizon disagreement without over-trading.`,
        tradeoffs:
          'Balances downside control and rebound capture, but execution depends on disciplined signal confirmation.',
        proposedShiftCad: 0,
      }
    }

    const nearTermAsset = pickAssetByDirection(inputs, 'positive')
    const shift = computeShift(
      inputs,
      nearTermAsset.ticker,
      nearTermAsset.impact,
      'negative',
      inputs.sixMonthExpectedImpactCad,
      'one_month',
      0.28,
    )
    return {
      id: 'rec-medium-term',
      horizon: 'one_month',
      summary: `Use any 1-month strength to trim ${formatCadAbs(shift)} from ${nearTermAsset.ticker} if long-horizon downside signals stay active.`,
      rationale: `Near-term model is ${oneWeekExpected} but 6-month model is ${sixMonthExpected}. This harvests gains while de-risking for slower-moving fundamentals.`,
      tradeoffs:
        'Reduces long-term downside exposure, but can leave return on the table if the rally extends.',
      proposedShiftCad: -shift,
    }
  }

  const direction =
    inputs.sixMonthDirection !== 'ambiguous' ? inputs.sixMonthDirection : inputs.oneWeekDirection
  const asset = pickAssetByDirection(inputs, direction)
  const blendedExpectedImpactCad = Math.round(
    inputs.oneWeekExpectedImpactCad * 0.35 + inputs.sixMonthExpectedImpactCad * 0.65,
  )
  const shift = computeShift(
    inputs,
    asset.ticker,
    asset.impact,
    direction,
    blendedExpectedImpactCad,
    'one_month',
    0.3,
  )

  if (direction === 'negative') {
    return {
      id: 'rec-medium-term',
      horizon: 'one_month',
      summary: `If the thesis still holds after 1 month, trim an additional ${formatCadAbs(shift)} from ${asset.ticker}.`,
      rationale: `Both horizons remain downside-leaning (${oneWeekExpected} to ${sixMonthExpected}), so gradual de-risking is preferred over one-time liquidation.`,
      tradeoffs:
        'Improves risk control with smoother execution, but may lag a sudden recovery.',
      proposedShiftCad: -shift,
    }
  }

  if (direction === 'positive') {
    if (shift <= 0) {
      return {
        id: 'rec-medium-term',
        horizon: 'one_month',
        summary: `Keep ${asset.ticker} at current size over the next month; concentration limits are already binding.`,
        rationale: `Both horizons support upside (${oneWeekExpected} to ${sixMonthExpected}), but the portfolio is already near its single-name cap for ${asset.ticker}.`,
        tradeoffs:
          'Protects diversification while preserving existing exposure, but may miss some upside if leadership persists.',
        proposedShiftCad: 0,
      }
    }
    return {
      id: 'rec-medium-term',
      horizon: 'one_month',
      summary: `If confirmation remains strong after 1 month, add ${formatCadAbs(shift)} to ${asset.ticker}.`,
      rationale: `Both horizons support upside (${oneWeekExpected} to ${sixMonthExpected}), and phased sizing keeps risk-adjusted conviction aligned with evidence.`,
      tradeoffs:
        'Builds exposure with confirmation, but adds concentration risk if leadership rotates.',
      proposedShiftCad: shift,
    }
  }

  return {
    id: 'rec-medium-term',
    horizon: 'one_month',
    summary: 'Set a 1-month review checkpoint and rebalance only if directional evidence strengthens.',
    rationale: `Current horizon estimates remain mixed (${oneWeekExpected} vs ${sixMonthExpected}), so conditional execution is more robust than immediate allocation changes.`,
    tradeoffs:
      'Avoids unnecessary turnover, but may delay risk reduction if conditions deteriorate quickly.',
    proposedShiftCad: 0,
  }
}

function longTermRecommendation(inputs: RecommendationInputs): Recommendation {
  const asset = pickAssetByDirection(inputs, inputs.sixMonthDirection)
  const shift = computeShift(
    inputs,
    asset.ticker,
    asset.impact,
    inputs.sixMonthDirection,
    inputs.sixMonthExpectedImpactCad,
    'six_month',
    0.55,
  )
  const sixMonthExpected = formatCadSigned(inputs.sixMonthExpectedImpactCad)
  const sleeve = diversificationSleeve(inputs)
  const lowRiskProfile =
    inputs.profile.riskTolerance === 'low' || inputs.profile.investmentHorizonYears <= 10

  if (inputs.sixMonthDirection === 'negative') {
    return {
      id: 'rec-long-term',
      horizon: 'six_month',
      summary: `Over 6 months, rotate ${formatCadAbs(shift)} out of ${asset.ticker} into ${sleeve}.`,
      rationale: `6-month modeled portfolio effect is ${sixMonthExpected}. This reduces structural downside while keeping progress toward "${primaryGoal(inputs)}".`,
      tradeoffs:
        'Improves resilience if adverse drivers persist, but may forgo upside from a sharp mean reversion.',
      proposedShiftCad: -shift,
    }
  }

  if (inputs.sixMonthDirection === 'positive') {
    if (lowRiskProfile) {
      if (shift <= 0) {
        return {
          id: 'rec-long-term',
          horizon: 'six_month',
          summary: `Over 6 months, keep ${asset.ticker} at policy weight and route new capital to ${sleeve}.`,
          rationale: `6-month model is ${sixMonthExpected}, but concentration controls prevent additional sizing in ${asset.ticker}.`,
          tradeoffs:
            'Maintains discipline and diversification, but can lag a concentrated momentum outcome.',
          proposedShiftCad: 0,
        }
      }
      return {
        id: 'rec-long-term',
        horizon: 'six_month',
        summary: `Over 6 months, keep ${asset.ticker} at core weight and direct ${formatCadAbs(shift)} of new capital into ${sleeve}.`,
        rationale: `6-month model is ${sixMonthExpected}. For a lower-risk profile, this captures part of the upside while avoiding concentration drift.`,
        tradeoffs:
          'Preserves diversification discipline, but can underperform a full conviction overweight.',
        proposedShiftCad: shift,
      }
    }

    if (shift <= 0) {
      return {
        id: 'rec-long-term',
        horizon: 'six_month',
        summary: `Over 6 months, hold ${asset.ticker} near current weight; reallocate new capital to ${sleeve} instead.`,
        rationale: `6-month modeled portfolio effect is ${sixMonthExpected}, but position sizing is capped by single-name concentration limits.`,
        tradeoffs:
          'Preserves risk controls while keeping thesis exposure, but reduces upside torque from further concentration.',
        proposedShiftCad: 0,
      }
    }

    return {
      id: 'rec-long-term',
      horizon: 'six_month',
      summary: `Over 6 months, phase ${formatCadAbs(shift)} into ${asset.ticker} while capping single-position concentration.`,
      rationale: `6-month modeled portfolio effect is ${sixMonthExpected}, and your ${inputs.profile.riskTolerance}-risk profile supports measured accumulation tied to persistent drivers.`,
      tradeoffs:
        'Improves participation in the favorable thesis, but raises concentration sensitivity.',
      proposedShiftCad: shift,
    }
  }

  return {
    id: 'rec-long-term',
    horizon: 'six_month',
    summary: `Over 6 months, keep strategic weights stable and rebalance only to policy bands in ${sleeve}.`,
    rationale: `6-month modeled effect is ${sixMonthExpected} (mixed), so strategic discipline is higher quality than directional bets.`,
    tradeoffs:
      'Maintains consistency and lowers regret risk, but may miss a prolonged directional move.',
    proposedShiftCad: 0,
  }
}

export function buildRecommendations(inputs: RecommendationInputs): ReadonlyArray<Recommendation> {
  return [
    shortTermRecommendation(inputs),
    mediumTermRecommendation(inputs),
    longTermRecommendation(inputs),
  ]
}

export function detectRecommendationTension(
  recommendations: ReadonlyArray<Recommendation>,
  inputs: RecommendationInputs,
): TensionAnalysis | undefined {
  if (!inputs.context.hasCompetingEffects) return undefined

  const shortTerm = recommendations.find((recommendation) => recommendation.horizon === 'one_week')
  const longTerm = recommendations.find((recommendation) => recommendation.horizon === 'six_month')
  if (!shortTerm || !longTerm) return undefined

  const hasDirectionalConflict =
    inputs.oneWeekDirection !== 'ambiguous' &&
    inputs.sixMonthDirection !== 'ambiguous' &&
    inputs.oneWeekDirection !== inputs.sixMonthDirection

  if (hasDirectionalConflict) {
    return {
      shortTermView: shortTerm.summary,
      longTermView: longTerm.summary,
      explanation: `The 1-week model (${formatCadSigned(inputs.oneWeekExpectedImpactCad)}) and 6-month model (${formatCadSigned(inputs.sixMonthExpectedImpactCad)}) point in opposite directions.`,
      whatEachAssumes:
        'Short-horizon view assumes liquidity/sentiment dominates now; long-horizon view assumes slower fundamental transmission dominates over time.',
    }
  }

  return {
    shortTermView: shortTerm.summary,
    longTermView: longTerm.summary,
    explanation: `Competing causal paths are active even though the dominant direction is consistent (${formatCadSigned(inputs.oneWeekExpectedImpactCad)} to ${formatCadSigned(inputs.sixMonthExpectedImpactCad)}).`,
    whatEachAssumes:
      'Base case assumes the dominant path persists; risk case assumes opposing paths strengthen and reduce conviction.',
  }
}
