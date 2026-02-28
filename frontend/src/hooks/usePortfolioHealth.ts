import { useMemo } from 'react'
import type { ExposureMap, HealthScore, Signal } from '@prism/shared'
import { computeHealthScore } from '../utils/health-scoring'

interface PortfolioHealthState {
  readonly healthScore: HealthScore | null
}

/**
 * Computes portfolio health score from exposure data and active signals.
 * Health is dynamic — it drops when active signals stress concentrated sectors.
 */
export function usePortfolioHealth(
  exposureMap: ExposureMap | null,
  signals: ReadonlyArray<Signal> = [],
): PortfolioHealthState {
  const healthScore = useMemo(() => {
    if (!exposureMap) return null
    return computeHealthScore(exposureMap, signals)
  }, [exposureMap, signals])

  return { healthScore }
}
