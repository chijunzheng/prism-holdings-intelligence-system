import type { Portfolio, Holding } from '@prism/shared'

const EVAL_DATE = '2025-12-31T00:00:00.000Z'

const HOLDING_SPECS: ReadonlyArray<{
  ticker: string
  name: string
  type: Holding['type']
  valueCad: number
}> = [
  { ticker: 'VFV', name: 'Vanguard S&P 500 Index ETF', type: 'ETF', valueCad: 10000 },
  { ticker: 'XIC', name: 'iShares Core S&P/TSX Capped Composite Index ETF', type: 'ETF', valueCad: 10000 },
  { ticker: 'ZAG', name: 'BMO Aggregate Bond Index ETF', type: 'BOND_ETF', valueCad: 10000 },
  { ticker: 'ZEB', name: 'BMO Equal Weight Banks Index ETF', type: 'ETF', valueCad: 10000 },
  { ticker: 'XEG', name: 'iShares S&P/TSX Capped Energy Index ETF', type: 'ETF', valueCad: 10000 },
  { ticker: 'XGD', name: 'iShares S&P/TSX Global Gold Index ETF', type: 'ETF', valueCad: 10000 },
]

export function buildCanonicalEvalPortfolio(): Portfolio {
  const holdings = HOLDING_SPECS.map((spec) => ({
    ticker: spec.ticker,
    name: spec.name,
    type: spec.type,
    valueCad: spec.valueCad,
    units: 100,
    accountType: 'TFSA' as const,
    dataAsOf: EVAL_DATE,
  }))

  return {
    userId: 'eval-canonical',
    accounts: [
      {
        id: 'eval-tfsa',
        type: 'TFSA',
        holdings,
      },
    ],
    totalValueCad: holdings.reduce((sum, h) => sum + h.valueCad, 0),
    lastUpdated: EVAL_DATE,
  }
}
