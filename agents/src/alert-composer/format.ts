import type { UserProfile } from '@prism/shared'
import type { TemporalAnalysis } from '../temporal-reasoner'
import type { ToneLevel } from '../personalization'
import type { AlertMateriality } from './thresholds'

function formatCad(value: number): string {
  return `$${Math.abs(Math.round(value)).toLocaleString('en-CA')}`
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function primaryAssetLabel(analysis: TemporalAnalysis): string {
  const top = [...analysis.impactClassifications].sort(
    (a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact),
  )[0]
  return top?.ticker ?? top?.assetLabel ?? 'core holdings'
}

export interface FormattedAlertPayload {
  readonly headline: string
  readonly body: string
  readonly signalCard: {
    readonly headline: string
    readonly classificationBadge: 'transient' | 'structural' | 'ambiguous'
    readonly materialityIndicator: string
  }
}

export function formatAlertPayload(params: {
  analysis: TemporalAnalysis
  profile: UserProfile
  tone: ToneLevel
  materiality: AlertMateriality
}): FormattedAlertPayload {
  const { analysis, profile, tone, materiality } = params
  const asset = primaryAssetLabel(analysis)
  const oneMonthImpact = analysis.timeBuckets.oneMonth.expectedDollarImpact
  const impactCad = formatCad(oneMonthImpact)
  const directionWord = oneMonthImpact < 0 ? 'downside' : oneMonthImpact > 0 ? 'upside' : 'mixed'

  const headline = `${titleCase(analysis.classification)} ${directionWord} signal for ${asset} (${titleCase(materiality)} materiality)`

  let body: string
  if (tone === 'simple') {
    body =
      `In plain terms, this could affect about ${impactCad} over the next month. ` +
      `At age ${profile.age} with ${profile.riskTolerance} risk tolerance, consider the short- and long-term options shown before acting.`
  } else if (tone === 'advanced') {
    body =
      `Transmission mechanisms indicate ${analysis.classification} pressure with a one-month expected move near ${impactCad}. ` +
      `Given your ${profile.riskTolerance} profile and ${profile.investmentHorizonYears}-year horizon, weigh path dependency and scenario tradeoffs before rebalancing.`
  } else {
    body =
      `Prism estimates about ${impactCad} of one-month impact with ${Math.round(analysis.confidence * 100)}% confidence. ` +
      `For your ${profile.riskTolerance} profile, review competing short- vs long-horizon recommendations before making changes.`
  }

  return {
    headline,
    body,
    signalCard: {
      headline,
      classificationBadge: analysis.classification,
      materialityIndicator: `${titleCase(materiality)} materiality`,
    },
  }
}

export function passesAdvisorCallTest(materiality: AlertMateriality, confidence: number): boolean {
  return materiality !== 'low' && confidence >= 0.6
}
