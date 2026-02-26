import type { TemporalClassification } from '@prism/shared'
import type { ImpactDirection, ImpactEstimate, TemporalReasoningContext } from './types'

interface TimeBucketMultipliers {
  readonly oneWeek: number
  readonly oneMonth: number
  readonly sixMonth: number
}

function round(value: number): number {
  return Math.round(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toDirection(expectedDollarImpact: number): ImpactDirection {
  if (expectedDollarImpact > 25) return 'positive'
  if (expectedDollarImpact < -25) return 'negative'
  return 'ambiguous'
}

function multipliersFor(classification: TemporalClassification): TimeBucketMultipliers {
  if (classification === 'transient') {
    return { oneWeek: 1.0, oneMonth: 0.55, sixMonth: 0.2 }
  }

  if (classification === 'structural') {
    return { oneWeek: 0.45, oneMonth: 0.85, sixMonth: 1.35 }
  }

  return { oneWeek: 0.65, oneMonth: 0.55, sixMonth: 0.45 }
}

function buildEstimate(expected: number, confidence: number, spreadFactor: number): ImpactEstimate {
  const spread = Math.max(Math.abs(expected) * spreadFactor, 40)
  const low = round(expected - spread)
  const high = round(expected + spread)
  const roundedExpected = round(expected)

  return {
    direction: toDirection(roundedExpected),
    expectedDollarImpact: roundedExpected,
    lowDollarImpact: Math.min(low, high),
    highDollarImpact: Math.max(low, high),
    confidence: clamp(confidence, 0, 1),
  }
}

export function estimateTimeBuckets(
  context: TemporalReasoningContext,
): {
  readonly oneWeek: ImpactEstimate
  readonly oneMonth: ImpactEstimate
  readonly sixMonth: ImpactEstimate
} {
  const multipliers = multipliersFor(context.classification)
  const baselineMagnitude = Math.max(Math.abs(context.netDollarImpact), 100)
  const baselineDirection = context.netDollarImpact !== 0 ? Math.sign(context.netDollarImpact) : 0
  const edgeDirection = context.directionBias === 0 ? 0 : Math.sign(context.directionBias)
  const directionFromSignal = baselineDirection || edgeDirection || -1

  const spreadFactor = context.classification === 'ambiguous' ? 0.5 : 0.3

  let oneWeek = baselineMagnitude * multipliers.oneWeek * directionFromSignal
  let oneMonth = baselineMagnitude * multipliers.oneMonth * directionFromSignal
  let sixMonth = baselineMagnitude * multipliers.sixMonth * directionFromSignal

  // When effects compete, reduce conviction, but do not force a direction flip.
  if (context.classification === 'ambiguous' && context.hasCompetingEffects) {
    oneWeek = baselineMagnitude * 0.26 * directionFromSignal
    oneMonth = baselineMagnitude * 0.2 * directionFromSignal
    sixMonth = baselineMagnitude * 0.18 * directionFromSignal
  } else if (context.hasCompetingEffects && context.directionBias === 0) {
    oneWeek = baselineMagnitude * 0.3 * directionFromSignal
    oneMonth = baselineMagnitude * 0.24 * directionFromSignal
    sixMonth = baselineMagnitude * 0.2 * directionFromSignal
  }

  return {
    oneWeek: buildEstimate(oneWeek, context.confidence * 0.95, spreadFactor),
    oneMonth: buildEstimate(oneMonth, context.confidence * 0.9, spreadFactor),
    sixMonth: buildEstimate(sixMonth, context.confidence * 0.85, spreadFactor),
  }
}
