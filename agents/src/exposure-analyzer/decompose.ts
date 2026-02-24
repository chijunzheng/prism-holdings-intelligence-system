import type { Portfolio, Holding, FundComposition } from '@prism/shared'

/**
 * A single asset-level exposure entry before aggregation.
 * Represents one underlying asset's contribution from one holding.
 */
export interface RawExposure {
  readonly assetName: string
  readonly assetTicker: string | undefined
  readonly sector: string
  readonly country: string
  readonly valueCad: number
  readonly sourceFundTicker: string
  readonly weightInFund: number
}

/**
 * Decomposes a portfolio into raw asset-level exposures by looking through
 * ETF/fund wrappers. Individual stocks pass through directly.
 */
export function decomposePortfolio(
  portfolio: Portfolio,
  getFund: (ticker: string) => FundComposition | undefined,
): { readonly exposures: ReadonlyArray<RawExposure>; readonly staleFunds: ReadonlyArray<string> } {
  const exposures: RawExposure[] = []
  const staleFunds: string[] = []

  const allHoldings = portfolio.accounts.flatMap((account) => account.holdings)

  for (const holding of allHoldings) {
    if (holding.type === 'STOCK') {
      exposures.push(decomposeStock(holding))
    } else {
      const fund = getFund(holding.ticker)
      if (!fund) {
        // Fund composition data missing — treat as opaque single-asset exposure
        exposures.push({
          assetName: holding.name,
          assetTicker: holding.ticker,
          sector: 'Unknown',
          country: 'Unknown',
          valueCad: holding.valueCad,
          sourceFundTicker: holding.ticker,
          weightInFund: 100,
        })
        staleFunds.push(holding.ticker)
        continue
      }

      // Check freshness: if data is >90 days old, flag as stale
      const dataAge = Date.now() - new Date(fund.dataAsOf).getTime()
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      if (dataAge > ninetyDaysMs) {
        staleFunds.push(holding.ticker)
      }

      exposures.push(...decomposeEtf(holding, fund))
    }
  }

  return { exposures, staleFunds }
}

function decomposeStock(holding: Holding): RawExposure {
  return {
    assetName: holding.name,
    assetTicker: holding.ticker,
    sector: 'Individual Stock',
    country: 'Unknown',
    valueCad: holding.valueCad,
    sourceFundTicker: holding.ticker,
    weightInFund: 100,
  }
}

function decomposeEtf(holding: Holding, fund: FundComposition): ReadonlyArray<RawExposure> {
  const exposures: RawExposure[] = []

  // Allocate holding value proportionally to each constituent
  for (const constituent of fund.holdings) {
    const valueCad = (holding.valueCad * constituent.weight) / 100
    exposures.push({
      assetName: constituent.name,
      assetTicker: constituent.ticker,
      sector: constituent.sector,
      country: constituent.country,
      valueCad,
      sourceFundTicker: holding.ticker,
      weightInFund: constituent.weight,
    })
  }

  // Remaining value not covered by top holdings → "Diversified Holdings"
  // Uses fund market context instead of generic "Other" to avoid
  // inflating a single catch-all category that triggers concentration alerts
  const coveredPercent = fund.coveragePercent
  if (coveredPercent < 100) {
    const remainingValue = (holding.valueCad * (100 - coveredPercent)) / 100
    exposures.push({
      assetName: `${fund.name} — Remaining Holdings`,
      assetTicker: undefined,
      sector: 'Diversified Holdings',
      country: fund.market,
      valueCad: remainingValue,
      sourceFundTicker: holding.ticker,
      weightInFund: 100 - coveredPercent,
    })
  }

  return exposures
}
