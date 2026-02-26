import { describe, it, expect } from 'vitest'
import type { Signal, StrategyConstraints } from '@prism/shared'
import { getPortfolioByUserId, getFundComposition } from '../../../../data/index'
import { analyze } from '../../exposure-analyzer/index'
import { generateMitigationCandidates } from '../index'

const TEST_SIGNAL: Signal = {
  id: 'sig-rate-financials',
  headline: 'BoC signals tighter lending conditions',
  description: 'Forward guidance points to tighter credit conditions for Canadian households.',
  affectedExposures: ['Canadian Financials', 'Canadian Housing'],
  relevanceScore: 0.88,
  urgency: 'high',
  temporalClassification: 'structural',
  sources: [
    {
      title: 'Bank of Canada Statement',
      url: 'https://example.com/boc-statement',
    },
  ],
  detectedAt: '2026-02-26T10:00:00Z',
  acknowledged: false,
}

const TEST_CONSTRAINTS: StrategyConstraints = {
  turnoverCapPct: 5,
  hardMaxTurnoverPct: 10,
  allowCashBuffer: true,
  taxAware: true,
  noMicrocaps: true,
  excludeLeveragedEtfs: true,
  maxNewPositions: 2,
}

describe('Strategy Candidate Engine', () => {
  it('generates ranked mitigation candidates with a cash option', async () => {
    const portfolio = getPortfolioByUserId('sarah-01')!
    const exposureResult = await analyze(portfolio, getFundComposition)
    expect(exposureResult.success).toBe(true)

    const candidates = generateMitigationCandidates({
      portfolio,
      exposureMap: exposureResult.data!,
      signal: TEST_SIGNAL,
      temporalAnalysis: null,
      constraints: TEST_CONSTRAINTS,
      maxCandidates: 5,
      getFundComposition,
    })

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThanOrEqual(5)
    expect(candidates.some((candidate) => candidate.type === 'cash')).toBe(true)
    expect(candidates.every((candidate) => candidate.rankScore > 0)).toBe(true)
  })

  it('applies no-microcaps guardrail to stock candidates', async () => {
    const portfolio = getPortfolioByUserId('sarah-01')!
    const exposureResult = await analyze(portfolio, getFundComposition)
    const candidates = generateMitigationCandidates({
      portfolio,
      exposureMap: exposureResult.data!,
      signal: TEST_SIGNAL,
      temporalAnalysis: null,
      constraints: TEST_CONSTRAINTS,
      maxCandidates: 8,
      getFundComposition,
    })

    const stocks = candidates.filter((candidate) => candidate.type === 'stock')
    expect(stocks.every((candidate) => candidate.isLargeCapProxy)).toBe(true)
  })
})
