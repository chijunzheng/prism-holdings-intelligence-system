import type { ExposureEntry } from '@prism/shared'
import type { RawExposure } from './decompose'

/**
 * Sector mapping: maps granular sectors to display categories.
 * Every sector gets a meaningful label — no generic "Other" bucket.
 */
const SECTOR_DISPLAY_MAP: Record<string, string> = {
  Financials: 'Canadian Financials',
  Technology: 'US Technology',
  Energy: 'Canadian Energy',
  Materials: 'Gold & Materials',
  'Government Bonds': 'Government Bonds',
  'Provincial Bonds': 'Provincial Bonds',
  'Corporate Bonds': 'Corporate Bonds',
  'Government Agencies': 'Government Bonds',
  'Consumer Discretionary': 'Consumer Discretionary',
  'Communication Services': 'Communication Services',
  'Health Care': 'Health Care',
  'Consumer Staples': 'Consumer Staples',
  Industrials: 'Industrials',
  'Real Estate': 'Real Estate',
  Utilities: 'Utilities',
  'Individual Stock': 'Individual Stocks',
  Other: 'Diversified Holdings',
  Unknown: 'Diversified Holdings',
}

/**
 * Refines sector categorization using country context.
 * Canadian financials and US tech need different labels
 * even though the raw sector might be the same.
 */
function categorize(sector: string, country: string): string {
  if (sector === 'Financials' && country === 'CA') return 'Canadian Financials'
  if (sector === 'Financials' && country === 'US') return 'US Financials'
  if (sector === 'Technology' && country === 'US') return 'US Technology'
  if (sector === 'Technology' && country === 'CA') return 'Canadian Technology'
  if (sector === 'Energy' && country === 'CA') return 'Canadian Energy'
  if (sector === 'Energy' && country === 'US') return 'US Energy'
  if (sector === 'Materials') return 'Gold & Materials'
  if (sector === 'Consumer Discretionary' || sector === 'Communication Services') {
    return country === 'US' ? 'US Technology' : `${sector} (${country || 'Global'})`
  }
  return SECTOR_DISPLAY_MAP[sector] ?? `${sector} (${country || 'Global'})`
}

/**
 * Aggregates raw exposures into display-ready ExposureEntry objects
 * grouped by category.
 */
export function aggregateExposures(
  rawExposures: ReadonlyArray<RawExposure>,
  totalPortfolioValue: number,
): ReadonlyArray<ExposureEntry> {
  // Group by display category
  const categoryMap = new Map<
    string,
    { valueCad: number; contributions: Map<string, number> }
  >()

  for (const exp of rawExposures) {
    const category = categorize(exp.sector, exp.country)
    const existing = categoryMap.get(category) ?? {
      valueCad: 0,
      contributions: new Map<string, number>(),
    }

    const updatedContributions = new Map(existing.contributions)
    const currentContribution = updatedContributions.get(exp.sourceFundTicker) ?? 0
    updatedContributions.set(exp.sourceFundTicker, currentContribution + exp.valueCad)

    categoryMap.set(category, {
      valueCad: existing.valueCad + exp.valueCad,
      contributions: updatedContributions,
    })
  }

  // Convert to ExposureEntry array, sorted by percentage descending
  const entries: ExposureEntry[] = []
  for (const [category, data] of categoryMap) {
    const percentage = (data.valueCad / totalPortfolioValue) * 100
    const contributingHoldings = Array.from(data.contributions.entries()).map(
      ([ticker, value]) => ({
        ticker,
        contribution: (value / totalPortfolioValue) * 100,
      }),
    )

    entries.push({
      category,
      percentage: Math.round(percentage * 10) / 10,
      valueCad: Math.round(data.valueCad * 100) / 100,
      contributingHoldings,
    })
  }

  return entries.sort((a, b) => b.percentage - a.percentage)
}
