import type { ExposureMap } from '@prism/shared'

export function formatExposureSummary(exposureMap: ExposureMap): string {
  if (exposureMap.exposures.length === 0) return 'No exposures available'

  return exposureMap.exposures
    .map((entry) => {
      const tickers = entry.contributingHoldings.map((h) => h.ticker).join(', ')
      return `${entry.category}: ${tickers || 'None'}`
    })
    .join('\n')
}
