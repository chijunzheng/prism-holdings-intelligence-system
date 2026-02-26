import { describe, it, expect } from 'vitest'
import type { Portfolio, StrategyConstraints, StrategyScenario } from '@prism/shared'
import { evaluateScenarioModel } from '../scoring'

const TEST_PORTFOLIO: Portfolio = {
  userId: 'sarah-01',
  accounts: [
    {
      id: 'tfsa-01',
      type: 'TFSA',
      holdings: [
        {
          ticker: 'VFV',
          name: 'Vanguard S&P 500 Index ETF',
          type: 'ETF',
          valueCad: 12000,
          units: 100,
          accountType: 'TFSA',
          dataAsOf: '2026-02-26T10:00:00Z',
        },
      ],
    },
    {
      id: 'cash-01',
      type: 'NON_REGISTERED',
      holdings: [
        {
          ticker: 'XIC',
          name: 'iShares Core S&P/TSX Capped Composite ETF',
          type: 'ETF',
          valueCad: 10000,
          units: 120,
          accountType: 'NON_REGISTERED',
          dataAsOf: '2026-02-26T10:00:00Z',
        },
      ],
    },
  ],
  totalValueCad: 22000,
  lastUpdated: '2026-02-26T10:00:00Z',
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

const TEST_SCENARIO: StrategyScenario = {
  items: [
    {
      candidateId: 'cand-zag',
      ticker: 'ZAG',
      name: 'BMO Aggregate Bond Index ETF',
      type: 'etf',
      rationale: 'Defensive allocation',
      confidence: 0.78,
      expectedMitigationCad: 180,
      diversificationScore: 0.86,
      estimatedTurnoverCostCad: 11,
      estimatedTaxCostCad: 8,
      allocationPct: 1.5,
    },
    {
      candidateId: 'cand-cash',
      ticker: 'CASH',
      name: 'Cash Buffer',
      type: 'cash',
      rationale: 'Optionality buffer',
      confidence: 0.75,
      expectedMitigationCad: 120,
      diversificationScore: 0.9,
      estimatedTurnoverCostCad: 3,
      estimatedTaxCostCad: 2,
      allocationPct: 1,
    },
  ],
}

describe('Strategy Scenario Scoring', () => {
  it('improves one-month downside for negative baseline', () => {
    const result = evaluateScenarioModel({
      objective: 'minimize_one_month_downside_with_six_month_guardrail',
      scenario: TEST_SCENARIO,
      constraints: TEST_CONSTRAINTS,
      baselineOneMonthCad: -1200,
      baselineSixMonthCad: -700,
      portfolio: TEST_PORTFOLIO,
    })

    expect(result.proposedOneMonthCad).toBeGreaterThan(result.baselineOneMonthCad)
    expect(result.downsideReductionCad).toBeGreaterThan(0)
    expect(result.humanDecisionRequired).toBe(true)
  })

  it('flags warnings when turnover exceeds caps', () => {
    const highTurnoverScenario: StrategyScenario = {
      items: TEST_SCENARIO.items.map((item) => ({ ...item, allocationPct: 6 })),
    }

    const result = evaluateScenarioModel({
      objective: 'minimize_one_month_downside_with_six_month_guardrail',
      scenario: highTurnoverScenario,
      constraints: TEST_CONSTRAINTS,
      baselineOneMonthCad: -1200,
      baselineSixMonthCad: -700,
      portfolio: TEST_PORTFOLIO,
    })

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.turnoverPct).toBeGreaterThan(TEST_CONSTRAINTS.turnoverCapPct)
  })
})
