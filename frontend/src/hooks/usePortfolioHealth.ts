import { useMemo } from 'react'
import type { ExposureMap, HealthScore } from '@prism/shared'
import { computeHealthScore } from '../utils/health-scoring'

interface PortfolioHealthState {
  readonly healthScore: HealthScore | null
}

/**
 * Computes portfolio health score from exposure data.
 * Pure computation — no API calls, no LLM involvement.
 */
export function usePortfolioHealth(exposureMap: ExposureMap | null): PortfolioHealthState {
  const healthScore = useMemo(() => {
    if (!exposureMap) return null
    return computeHealthScore(exposureMap)
  }, [exposureMap])

  return { healthScore }
}
