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
  const sectorMix = new Map<string, { sector: string; country: string; coveredWeight: number }>()
  let coveredWeight = 0

  // Allocate holding value proportionally to each constituent
  for (const constituent of fund.holdings) {
    const country = normalizeCountry(constituent.country, fund.market)
    const valueCad = (holding.valueCad * constituent.weight) / 100
    exposures.push({
      assetName: constituent.name,
      assetTicker: constituent.ticker,
      sector: constituent.sector,
      country,
      valueCad,
      sourceFundTicker: holding.ticker,
      weightInFund: constituent.weight,
    })

    coveredWeight += constituent.weight
    const mixKey = `${constituent.sector}::${country}`
    const existingMix = sectorMix.get(mixKey) ?? {
      sector: constituent.sector,
      country,
      coveredWeight: 0,
    }
    sectorMix.set(mixKey, {
      ...existingMix,
      coveredWeight: existingMix.coveredWeight + constituent.weight,
    })
  }

  // Remaining value not covered by top holdings:
  // infer sector distribution from known constituents to keep output actionable.
  const remainingWeight = Math.max(0, 100 - fund.coveragePercent)
  if (remainingWeight > 0) {
    if (coveredWeight > 0 && sectorMix.size > 0) {
      for (const bucket of sectorMix.values()) {
        const inferredWeightInFund = (remainingWeight * bucket.coveredWeight) / coveredWeight
        if (inferredWeightInFund <= 0) continue

        exposures.push({
          assetName: `${fund.name} — Inferred Remaining Constituents`,
          assetTicker: undefined,
          sector: bucket.sector,
          country: bucket.country,
          valueCad: (holding.valueCad * inferredWeightInFund) / 100,
          sourceFundTicker: holding.ticker,
          weightInFund: inferredWeightInFund,
        })
      }
    } else {
      exposures.push({
        assetName: `${fund.name} — Unclassified Remaining Constituents`,
        assetTicker: undefined,
        sector: unclassifiedSectorForAssetClass(fund.assetClass),
        country: normalizeCountry(undefined, fund.market),
        valueCad: (holding.valueCad * remainingWeight) / 100,
        sourceFundTicker: holding.ticker,
        weightInFund: remainingWeight,
      })
    }
  }

  return exposures
}

function normalizeCountry(country: string | undefined, fallbackMarket: string): string {
  const raw = (country ?? fallbackMarket).trim().toUpperCase()
  if (raw === 'CANADA' || raw === 'CAN') return 'CA'
  if (raw === 'UNITED STATES' || raw === 'UNITED STATES OF AMERICA' || raw === 'USA') return 'US'
  if (raw.length === 0) return 'Global'
  return raw
}

function unclassifiedSectorForAssetClass(assetClass: FundComposition['assetClass']): string {
  switch (assetClass) {
    case 'equity':
      return 'Unclassified Equity'
    case 'fixed_income':
      return 'Unclassified Fixed Income'
    case 'commodity':
      return 'Unclassified Commodity'
    case 'mixed':
      return 'Unclassified Multi-Asset'
  }
}
