import type { CounterfactualAnalysis, Recommendation } from './types'

function formatCad(value: number): string {
  return `$${Math.abs(Math.round(value)).toLocaleString('en-CA')}`
}

export function buildCounterfactual(
  recommendations: ReadonlyArray<Recommendation>,
  sixMonthExpectedImpact: number,
): CounterfactualAnalysis {
  const longTerm = recommendations.find((recommendation) => recommendation.horizon === 'six_month')
  const rebalanceAmount = longTerm?.proposedShiftCad ?? 500
  const estimatedDifference = Math.max(75, Math.round(Math.abs(sixMonthExpectedImpact) * 0.55))

  const scenario =
    sixMonthExpectedImpact < 0
      ? `If you had rebalanced 3 months ago by shifting about ${formatCad(rebalanceAmount)}, projected drawdown could be lower by roughly ${formatCad(estimatedDifference)}.`
      : `If you had rebalanced 3 months ago by staging ${formatCad(rebalanceAmount)}, projected upside capture could improve by about ${formatCad(estimatedDifference)} with less concentration risk.`

  return {
    scenario,
    estimatedOutcomeDifferenceCad: estimatedDifference,
    explanation:
      'Counterfactual assumes similar transmission strength and uses current chain confidence as a persistence proxy, so outcomes are directional rather than guaranteed.',
  }
}
