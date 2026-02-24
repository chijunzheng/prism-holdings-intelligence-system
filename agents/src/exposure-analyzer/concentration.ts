import type { ExposureEntry, ConcentrationWarning } from '@prism/shared'
import { CONCENTRATION_THRESHOLDS } from '@prism/shared'

/**
 * Evaluates exposure entries against concentration thresholds
 * and generates warnings for over-concentrated positions.
 */
export function detectConcentrations(
  exposures: ReadonlyArray<ExposureEntry>,
): ReadonlyArray<ConcentrationWarning> {
  const warnings: ConcentrationWarning[] = []

  for (const entry of exposures) {
    const severity = getSeverity(entry.percentage)
    if (!severity) continue

    warnings.push({
      category: entry.category,
      percentage: entry.percentage,
      severity,
      message: buildMessage(entry.category, entry.percentage, severity),
    })
  }

  return warnings.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

function getSeverity(percentage: number): 'low' | 'medium' | 'high' | 'critical' | null {
  if (percentage >= CONCENTRATION_THRESHOLDS.CRITICAL) return 'critical'
  if (percentage >= CONCENTRATION_THRESHOLDS.HIGH) return 'high'
  if (percentage >= CONCENTRATION_THRESHOLDS.MEDIUM) return 'medium'
  if (percentage >= CONCENTRATION_THRESHOLDS.LOW) return 'low'
  return null
}

function buildMessage(
  category: string,
  percentage: number,
  severity: 'low' | 'medium' | 'high' | 'critical',
): string {
  const thresholdMap = {
    low: CONCENTRATION_THRESHOLDS.LOW,
    medium: CONCENTRATION_THRESHOLDS.MEDIUM,
    high: CONCENTRATION_THRESHOLDS.HIGH,
    critical: CONCENTRATION_THRESHOLDS.CRITICAL,
  }
  return `${category} concentration at ${percentage}% exceeds ${thresholdMap[severity]}% threshold`
}
