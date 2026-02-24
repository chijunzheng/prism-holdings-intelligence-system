import { MAX_DAILY_NOTIFICATIONS, type TemporalClassification, type UserProfile } from '@prism/shared'
import { getUserContext } from './context'

export type ToneLevel = 'simple' | 'moderate' | 'advanced'

export interface MaterialityThreshold {
  readonly minPortfolioImpactPct: number
  readonly structuralUrgency: 'medium' | 'high' | 'critical'
}

export interface PersonalizationEngine {
  getUserContext(userId: string): UserProfile
  getMaterialityThreshold(profile: UserProfile): MaterialityThreshold
  getUrgencyMultiplier(profile: UserProfile, classification: TemporalClassification): number
  getToneLevel(profile: UserProfile): ToneLevel
  getEffectiveDailyAlertCap(profile: UserProfile): number
}

function getMaterialityThreshold(profile: UserProfile): MaterialityThreshold {
  if (profile.riskTolerance === 'low') {
    return { minPortfolioImpactPct: 1, structuralUrgency: 'critical' }
  }
  if (profile.riskTolerance === 'high') {
    return { minPortfolioImpactPct: 5, structuralUrgency: 'medium' }
  }
  return { minPortfolioImpactPct: 2, structuralUrgency: 'high' }
}

function getUrgencyMultiplier(
  profile: UserProfile,
  classification: TemporalClassification,
): number {
  const riskMultiplier =
    profile.riskTolerance === 'low' ? 1.2 : profile.riskTolerance === 'high' ? 0.85 : 1.0
  const classificationMultiplier =
    classification === 'structural' ? 1.25 : classification === 'ambiguous' ? 0.9 : 1.0
  return riskMultiplier * classificationMultiplier
}

function getToneLevel(profile: UserProfile): ToneLevel {
  if (profile.financialLiteracy === 'low') return 'simple'
  if (profile.financialLiteracy === 'high') return 'advanced'
  return 'moderate'
}

function getEffectiveDailyAlertCap(profile: UserProfile): number {
  return Math.max(0, Math.min(MAX_DAILY_NOTIFICATIONS, profile.preferences.maxDailyAlerts))
}

export function createPersonalizationEngine(): PersonalizationEngine {
  return {
    getUserContext,
    getMaterialityThreshold,
    getUrgencyMultiplier,
    getToneLevel,
    getEffectiveDailyAlertCap,
  }
}

export { getUserContext } from './context'
