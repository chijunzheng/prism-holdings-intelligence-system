import type { StrategyCandidate, StrategyConstraints } from '@prism/shared'

function isLeveragedOrInverse(label: string): boolean {
  const normalized = label.toLowerCase()
  return (
    normalized.includes('2x') ||
    normalized.includes('3x') ||
    normalized.includes('leveraged') ||
    normalized.includes('inverse') ||
    normalized.includes('ultra') ||
    normalized.includes('bear')
  )
}

export function applyCandidateFilters(
  candidates: ReadonlyArray<StrategyCandidate>,
  constraints: StrategyConstraints,
): ReadonlyArray<StrategyCandidate> {
  const deduped = new Map<string, StrategyCandidate>()

  for (const candidate of candidates) {
    const key = candidate.ticker.trim().toUpperCase()

    if (constraints.noMicrocaps && candidate.type === 'stock' && !candidate.isLargeCapProxy) {
      continue
    }

    if (constraints.excludeLeveragedEtfs && candidate.type === 'etf') {
      if (isLeveragedOrInverse(`${candidate.ticker} ${candidate.name}`)) {
        continue
      }
    }

    if (candidate.liquidityTier === 'low') continue

    const existing = deduped.get(key)
    if (!existing || candidate.rankScore > existing.rankScore) {
      deduped.set(key, candidate)
    }
  }

  return Array.from(deduped.values())
}
