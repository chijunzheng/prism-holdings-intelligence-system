import type { TemporalClassification } from '@prism/shared'
import type { TemporalAnalysis } from '../temporal-reasoner'
import type { MaterialityThreshold } from '../personalization'

export type AlertMateriality = 'low' | 'medium' | 'high'
export type AlertSuppressionReason = 'below_materiality' | 'frequency_cap' | 'duplicate'

export interface MaterialityEvaluation {
  readonly materiality: AlertMateriality
  readonly impactPct: number
  readonly shouldSurface: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function computePortfolioImpactPct(
  oneMonthExpectedImpactCad: number,
  totalPortfolioValueCad: number,
): number {
  const total = Math.max(totalPortfolioValueCad, 1)
  return round((Math.abs(oneMonthExpectedImpactCad) / total) * 100)
}

export function evaluateMateriality(
  analysis: TemporalAnalysis,
  threshold: MaterialityThreshold,
  totalPortfolioValueCad: number,
): MaterialityEvaluation {
  const impactPct = computePortfolioImpactPct(
    analysis.timeBuckets.oneMonth.expectedDollarImpact,
    totalPortfolioValueCad,
  )

  if (impactPct < threshold.minPortfolioImpactPct) {
    return { materiality: 'low', impactPct, shouldSurface: false }
  }

  const highBar = threshold.minPortfolioImpactPct * 2
  const structuralBonus =
    analysis.classification === 'structural' && analysis.confidence >= 0.75 ? 0.5 : 0
  const score = impactPct + structuralBonus

  if (score >= highBar) {
    return { materiality: 'high', impactPct, shouldSurface: true }
  }

  if (impactPct >= threshold.minPortfolioImpactPct * 1.25) {
    return { materiality: 'medium', impactPct, shouldSurface: true }
  }

  return { materiality: 'low', impactPct, shouldSurface: true }
}

function urgencyToScore(
  classification: TemporalClassification,
  materiality: AlertMateriality,
  confidence: number,
): number {
  const classificationBase =
    classification === 'structural' ? 2.4 : classification === 'transient' ? 1.7 : 1.3
  const materialityBoost = materiality === 'high' ? 1 : materiality === 'medium' ? 0.55 : 0.2
  return classificationBase + materialityBoost + confidence * 0.8
}

function scoreToUrgency(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 4) return 'critical'
  if (score >= 3) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

export function deriveUrgency(
  classification: TemporalClassification,
  materiality: AlertMateriality,
  confidence: number,
  urgencyMultiplier: number,
): 'low' | 'medium' | 'high' | 'critical' {
  const score = urgencyToScore(classification, materiality, confidence)
  return scoreToUrgency(clamp(score * urgencyMultiplier, 0, 5))
}
