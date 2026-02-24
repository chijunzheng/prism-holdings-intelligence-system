import type { Overlap } from '@prism/shared'
import type { RawExposure } from './decompose'

/**
 * Detects overlapping assets — the same underlying asset appearing
 * in multiple ETFs/funds. Returns only assets with >1 source.
 */
export function detectOverlaps(
  rawExposures: ReadonlyArray<RawExposure>,
  totalPortfolioValue: number,
): ReadonlyArray<Overlap> {
  // Group by asset identity (prefer ticker, fall back to name)
  const assetMap = new Map<
    string,
    {
      assetName: string
      assetTicker: string | undefined
      totalValue: number
      sources: Map<string, number>
    }
  >()

  for (const exp of rawExposures) {
    // Skip "Other Holdings" aggregates
    if (!exp.assetTicker) continue

    const key = exp.assetTicker
    const existing = assetMap.get(key) ?? {
      assetName: exp.assetName,
      assetTicker: exp.assetTicker,
      totalValue: 0,
      sources: new Map<string, number>(),
    }

    const updatedSources = new Map(existing.sources)
    const currentWeight = updatedSources.get(exp.sourceFundTicker) ?? 0
    updatedSources.set(exp.sourceFundTicker, currentWeight + exp.weightInFund)

    assetMap.set(key, {
      ...existing,
      totalValue: existing.totalValue + exp.valueCad,
      sources: updatedSources,
    })
  }

  // Filter to assets appearing in multiple funds
  const overlaps: Overlap[] = []
  for (const [, data] of assetMap) {
    if (data.sources.size < 2) continue

    overlaps.push({
      assetName: data.assetName,
      assetTicker: data.assetTicker,
      totalPercentage: Math.round((data.totalValue / totalPortfolioValue) * 1000) / 10,
      sources: Array.from(data.sources.entries()).map(([fundTicker, weightInFund]) => ({
        fundTicker,
        weightInFund,
      })),
    })
  }

  return overlaps.sort((a, b) => b.totalPercentage - a.totalPercentage)
}
