import type { Portfolio, ExposureMap, FundComposition } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { decomposePortfolio } from './decompose'
import { aggregateExposures } from './aggregate'
import { detectOverlaps } from './overlap'
import { detectConcentrations } from './concentration'

export const config: AgentConfig = {
  name: 'exposure-analyzer',
  description: 'Decomposes fund holdings into true asset-level exposure, detects concentrations',
  usesLlm: false,
}

/**
 * Analyzes a portfolio to produce a full ExposureMap with:
 * - Sector/category exposure breakdown
 * - Cross-holding overlap detection
 * - Concentration warnings
 * - Data freshness tracking
 */
export async function analyze(
  portfolio: Portfolio,
  getFund: (ticker: string) => FundComposition | undefined,
): Promise<AgentResult<ExposureMap>> {
  const start = performance.now()

  try {
    const { exposures: rawExposures, staleFunds } = decomposePortfolio(portfolio, getFund)

    const exposures = aggregateExposures(rawExposures, portfolio.totalValueCad)
    const overlaps = detectOverlaps(rawExposures, portfolio.totalValueCad)
    const warnings = detectConcentrations(exposures)

    const exposureMap: ExposureMap = {
      portfolioId: portfolio.userId,
      generatedAt: new Date().toISOString(),
      exposures,
      overlaps,
      warnings,
      dataFreshness: {
        allFresh: staleFunds.length === 0,
        staleFunds,
      },
    }

    return {
      success: true,
      data: exposureMap,
      durationMs: performance.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: performance.now() - start,
    }
  }
}
