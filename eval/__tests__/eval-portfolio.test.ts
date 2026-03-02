import { describe, it, expect } from 'vitest'
import { PortfolioSchema } from '@prism/shared'
import { buildCanonicalEvalPortfolio } from '../eval-portfolio'

describe('buildCanonicalEvalPortfolio', () => {
  it('builds a schema-valid canonical 6-ETF portfolio', () => {
    const portfolio = buildCanonicalEvalPortfolio()
    const parsed = PortfolioSchema.parse(portfolio)
    const tickers = parsed.accounts.flatMap((a) => a.holdings.map((h) => h.ticker))

    expect(parsed.totalValueCad).toBe(60000)
    expect(tickers.sort()).toEqual(['VFV', 'XEG', 'XGD', 'XIC', 'ZAG', 'ZEB'].sort())
  })
})
