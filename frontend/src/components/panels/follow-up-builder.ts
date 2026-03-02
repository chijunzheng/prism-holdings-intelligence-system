// Builds contextual follow-up suggestions from pipeline result data.
// Inspects the actual result to produce relevant, actionable next steps.

import type { PortfolioVerdict, FundManagerVerdict, Signal } from '@prism/shared'

/**
 * Generate follow-ups from a portfolio review result.
 * Considers: net vs gross gap, dominant signals, concentration, recommendation count.
 */
export function buildPortfolioReviewFollowUps(data: unknown): readonly string[] {
  const verdict = data as PortfolioVerdict | undefined
  if (!verdict) return []

  const suggestions: string[] = []
  const netMid = verdict.portfolioNetImpact?.mid ?? 0
  const grossMid = verdict.portfolioGrossImpact?.mid ?? 0
  const interactionGap = Math.abs(grossMid) - Math.abs(netMid)

  // Find the most impactful signal
  const signalImpacts = (verdict.signals ?? []).map((s) => {
    const impact = s.individualVerdict.holdingImpacts
      .map((h) => h.impact['1M']?.mid ?? 0)
      .reduce((sum, v) => sum + v, 0)
    return { headline: s.headline, impact, signalId: s.signalId }
  })
  const sorted = [...signalImpacts].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
  const topSignal = sorted[0]
  const topNegative = sorted.find((s) => s.impact < 0)

  // 1. If net impact is negative, ask about risk reduction
  if (netMid < -100) {
    suggestions.push('What are my options to reduce this risk?')
  }

  // 2. If there's a big interaction gap, highlight it
  if (interactionGap > 200 && suggestions.length < 3) {
    suggestions.push('Why do these signals offset each other?')
  }

  // 3. Drill into the most impactful signal
  if (topSignal && suggestions.length < 3) {
    const truncated = topSignal.headline.length > 40
      ? `${topSignal.headline.slice(0, 37)}...`
      : topSignal.headline
    suggestions.push(`Analyze "${truncated}" in detail`)
  }

  // 4. If there's a negative signal, ask about hedging
  if (topNegative && topNegative !== topSignal && suggestions.length < 3) {
    suggestions.push(`How does "${topNegative.headline.slice(0, 30)}" affect my holdings?`)
  }

  // 5. If recommendations exist, prompt action
  if ((verdict.recommendations?.length ?? 0) > 0 && suggestions.length < 3) {
    suggestions.push('Show me specific actions I can take')
  }

  // 6. Net positive — different tone
  if (netMid > 100 && suggestions.length < 3) {
    suggestions.push('Should I rebalance to lock in gains?')
  }

  // Fallback if nothing specific matched
  if (suggestions.length === 0) {
    suggestions.push('What should I do next?')
    suggestions.push('How does this compare to last month?')
  }

  return suggestions.slice(0, 3)
}

/**
 * Generate follow-ups from a single-signal analysis result.
 * Considers: direction, affected holdings, recommendation options.
 */
export function buildSignalAnalysisFollowUps(
  signal: Signal,
  verdict: FundManagerVerdict,
): readonly string[] {
  const suggestions: string[] = []

  const totalImpact = verdict.holdingImpacts
    .map((h) => h.impact['1M']?.mid ?? 0)
    .reduce((sum, v) => sum + v, 0)

  const affectedTickers = verdict.holdingImpacts
    .filter((h) => Math.abs(h.impact['1M']?.mid ?? 0) > 50)
    .map((h) => h.ticker)

  // 1. If negative impact, ask about protection
  if (totalImpact < -100) {
    suggestions.push('What can I do to protect against this?')
  }

  // 2. Drill into a specific affected holding
  if (affectedTickers.length > 0) {
    const ticker = affectedTickers[0]
    suggestions.push(`How exactly does this affect my ${ticker}?`)
  }

  // 3. If there are unresolved disagreements, explore them
  if (verdict.perspectiveBreakdown.unresolvedDisagreements.length > 0) {
    suggestions.push('What do the analysts disagree on?')
  }

  // 4. If recommendations exist
  if (verdict.recommendations.length > 1) {
    suggestions.push('Compare my options side by side')
  }

  // 5. Broader context — reference the signal for specificity
  if (suggestions.length < 3) {
    const headline = signal.headline
    if (headline.toLowerCase().includes('rate') || headline.toLowerCase().includes('inflation')) {
      suggestions.push('What if rates move the other way?')
    } else {
      suggestions.push('Run a full portfolio review')
    }
  }

  // 6. Positive signal — different options
  if (totalImpact > 100 && suggestions.length < 3) {
    suggestions.push('Should I increase my position?')
  }

  return suggestions.slice(0, 3)
}
