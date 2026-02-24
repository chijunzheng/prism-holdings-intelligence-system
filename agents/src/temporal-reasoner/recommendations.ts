import type { Recommendation, RecommendationInputs, TensionAnalysis } from './types'

function formatCad(value: number): string {
  return `$${Math.abs(Math.round(value)).toLocaleString('en-CA')}`
}

function clampMin(value: number, min = 100): number {
  return Math.max(min, Math.round(value))
}

function topImpactedAsset(inputs: RecommendationInputs): {
  readonly label: string
  readonly ticker: string
  readonly impact: number
} {
  const top = [...inputs.context.impactClassifications].sort(
    (a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact),
  )[0]

  if (!top) {
    return { label: 'highest-risk holding', ticker: 'core holding', impact: 400 }
  }

  return {
    label: top.assetLabel,
    ticker: top.ticker ?? top.assetLabel,
    impact: top.dollarImpact,
  }
}

function shortTermRecommendation(inputs: RecommendationInputs): Recommendation {
  const top = topImpactedAsset(inputs)
  const shift = clampMin(Math.abs(top.impact) * 0.45)
  const defensive = inputs.oneWeekDirection === 'negative'

  const summary = defensive
    ? `Consider trimming ${top.ticker} by ${formatCad(shift)} over the next week.`
    : `Consider holding ${top.ticker} and staging a ${formatCad(shift)} rebalance trigger.`

  return {
    id: 'rec-short-term',
    horizon: 'one_week',
    summary,
    rationale: `At age ${inputs.profile.age} with ${inputs.profile.riskTolerance} risk tolerance, this protects near-term volatility while keeping your primary goal (${inputs.profile.goals[0]}) funded.`,
    tradeoffs: defensive
      ? 'Reduces immediate drawdown risk, but may miss a sharp rebound if policy fears fade quickly.'
      : 'Preserves upside if the move reverses, but accepts short-term volatility if pressure persists.',
    proposedShiftCad: shift,
  }
}

function longTermRecommendation(inputs: RecommendationInputs): Recommendation {
  const top = topImpactedAsset(inputs)
  const shift = clampMin(Math.abs(top.impact) * 0.65)
  const sixMonthNegative = inputs.sixMonthDirection === 'negative'
  const lowRiskProfile =
    inputs.profile.riskTolerance === 'low' || inputs.profile.investmentHorizonYears <= 10

  const summary = sixMonthNegative
    ? `Over 6 months, rotate roughly ${formatCad(shift)} from ${top.ticker} into broader diversification sleeves.`
    : `Over 6 months, phase ${formatCad(shift)} into diversified assets while keeping a core ${top.ticker} position.`

  return {
    id: 'rec-long-term',
    horizon: 'six_month',
    summary,
    rationale: `Given age ${inputs.profile.age}, ${inputs.profile.riskTolerance} risk tolerance, and horizon ${inputs.profile.investmentHorizonYears} years, this aligns with "${inputs.profile.goals[0]}".`,
    tradeoffs: lowRiskProfile
      ? 'Improves resilience and capital preservation, but may cap upside during fast risk-on recoveries.'
      : 'Maintains growth participation, but diversification gains are slower than a full immediate rebalance.',
    proposedShiftCad: shift,
  }
}

function mediumTermRecommendation(inputs: RecommendationInputs): Recommendation {
  const top = topImpactedAsset(inputs)
  const shift = clampMin(Math.abs(top.impact) * 0.35)

  return {
    id: 'rec-medium-term',
    horizon: 'one_month',
    summary: `Set a one-month checkpoint: rebalance ${formatCad(shift)} in ${top.ticker} only if transmission mechanisms remain active.`,
    rationale: `This keeps flexibility for a ${inputs.profile.riskTolerance}-risk profile while linking decisions to observable follow-through in policy and earnings signals.`,
    tradeoffs:
      'Avoids premature trading if the thesis weakens, but delays risk reduction if the adverse trend accelerates.',
    proposedShiftCad: shift,
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

  if (inputs.oneWeekDirection === inputs.sixMonthDirection) return undefined

  return {
    shortTermView: shortTerm.summary,
    longTermView: longTerm.summary,
    explanation:
      'Short and long horizons diverge because immediate liquidity/sentiment effects conflict with slower fundamental earnings transmission.',
    whatEachAssumes:
      'Short-term assumes current flows dominate; long-term assumes structural mechanisms persist after initial volatility fades.',
  }
}
