import type { ExposureMap, Portfolio } from '@prism/shared'

const HOLDING_CATEGORIES: Record<string, string> = {
  VFV: 'US Equity',
  XIC: 'Canadian Equity',
  ZAG: 'Fixed Income',
  ZEB: 'Canadian Banks',
  XEG: 'Energy',
  XGD: 'Gold/Precious Metals',
  ZDV: 'Canadian Dividend',
  XQQ: 'US Tech',
}

function categorizeHolding(ticker: string): string {
  return HOLDING_CATEGORIES[ticker] ?? 'Other'
}

export function buildSimpleExposureMap(portfolio: Portfolio): ExposureMap {
  const byCategory = new Map<string, { valueCad: number; byTicker: Map<string, number> }>()
  const totalValue = portfolio.totalValueCad

  for (const account of portfolio.accounts) {
    for (const holding of account.holdings) {
      const category = categorizeHolding(holding.ticker)
      const categoryEntry = byCategory.get(category) ?? { valueCad: 0, byTicker: new Map<string, number>() }

      categoryEntry.valueCad += holding.valueCad
      categoryEntry.byTicker.set(
        holding.ticker,
        (categoryEntry.byTicker.get(holding.ticker) ?? 0) + holding.valueCad,
      )

      byCategory.set(category, categoryEntry)
    }
  }

  const exposures = [...byCategory.entries()]
    .map(([category, entry]) => ({
      category,
      percentage: totalValue > 0 ? (entry.valueCad / totalValue) * 100 : 0,
      valueCad: entry.valueCad,
      contributingHoldings: [...entry.byTicker.entries()].map(([ticker, valueCad]) => ({
        ticker,
        contribution: entry.valueCad > 0 ? (valueCad / entry.valueCad) * 100 : 0,
      })),
    }))
    .sort((a, b) => b.percentage - a.percentage)

  return {
    portfolioId: portfolio.userId,
    generatedAt: new Date().toISOString(),
    exposures,
    overlaps: [],
    warnings: [],
    dataFreshness: {
      allFresh: true,
      staleFunds: [],
    },
  }
}
