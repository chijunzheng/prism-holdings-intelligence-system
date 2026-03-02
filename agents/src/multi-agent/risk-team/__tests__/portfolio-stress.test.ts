import { describe, it, expect } from 'vitest'
import { choleskyDecomposition, runMonteCarloSimulation, runPortfolioStressTest } from '../portfolio-stress'

describe('choleskyDecomposition', () => {
  it('decomposes identity matrix to identity', () => {
    const identity = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
    const L = choleskyDecomposition(identity)

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(L[i][j]).toBeCloseTo(i === j ? 1 : 0, 10)
      }
    }
  })

  it('decomposes a valid 2x2 correlation matrix', () => {
    const matrix = [
      [1.0, 0.5],
      [0.5, 1.0],
    ]
    const L = choleskyDecomposition(matrix)

    // L * L^T should equal original matrix
    const reconstructed = [
      [L[0][0] * L[0][0] + L[0][1] * L[0][1], L[0][0] * L[1][0] + L[0][1] * L[1][1]],
      [L[1][0] * L[0][0] + L[1][1] * L[0][1], L[1][0] * L[1][0] + L[1][1] * L[1][1]],
    ]

    expect(reconstructed[0][0]).toBeCloseTo(1.0, 6)
    expect(reconstructed[0][1]).toBeCloseTo(0.5, 6)
    expect(reconstructed[1][0]).toBeCloseTo(0.5, 6)
    expect(reconstructed[1][1]).toBeCloseTo(1.0, 6)
  })

  it('handles a 3x3 correlation matrix', () => {
    const matrix = [
      [1.0, 0.3, 0.1],
      [0.3, 1.0, 0.2],
      [0.1, 0.2, 1.0],
    ]
    const L = choleskyDecomposition(matrix)

    // L should be lower triangular
    expect(L[0][1]).toBeCloseTo(0, 10)
    expect(L[0][2]).toBeCloseTo(0, 10)
    expect(L[1][2]).toBeCloseTo(0, 10)
  })
})

describe('runMonteCarloSimulation', () => {
  it('returns sorted outcomes', () => {
    const holdings = [
      { ticker: 'ZAG', holdingValueCad: 7600, expectedReturn: -0.02, volatility: 0.018 },
      { ticker: 'XIC', holdingValueCad: 8200, expectedReturn: -0.01, volatility: 0.023 },
    ]
    const correlationMatrix = [
      [1.0, 0.3],
      [0.3, 1.0],
    ]

    const { outcomes } = runMonteCarloSimulation({
      holdings,
      correlationMatrix,
      numSimulations: 1000,
    })

    // Outcomes should be sorted ascending
    for (let i = 1; i < outcomes.length; i++) {
      expect(outcomes[i]).toBeGreaterThanOrEqual(outcomes[i - 1])
    }
  })

  it('produces outcomes centered around expected impact', () => {
    const holdings = [
      { ticker: 'ZAG', holdingValueCad: 10000, expectedReturn: -0.03, volatility: 0.02 },
    ]
    const correlationMatrix = [[1.0]]

    const { outcomes } = runMonteCarloSimulation({
      holdings,
      correlationMatrix,
      numSimulations: 10000,
    })

    // Mean outcome should be close to expected: 10000 * -0.03 = -300
    const mean = outcomes.reduce((sum, o) => sum + o, 0) / outcomes.length
    expect(mean).toBeCloseTo(-300, -1) // Within ~$10
  })

  it('handles empty holdings', () => {
    const { outcomes } = runMonteCarloSimulation({
      holdings: [],
      correlationMatrix: [],
      numSimulations: 100,
    })

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toBe(0)
  })

  it('uncorrelated holdings have lower VaR than perfectly correlated', () => {
    const holdings = [
      { ticker: 'A', holdingValueCad: 10000, expectedReturn: -0.03, volatility: 0.05 },
      { ticker: 'B', holdingValueCad: 10000, expectedReturn: -0.03, volatility: 0.05 },
    ]

    const uncorrelated = [[1, 0], [0, 1]]
    const correlated = [[1, 0.95], [0.95, 1]]

    const { outcomes: uncorrOutcomes } = runMonteCarloSimulation({
      holdings,
      correlationMatrix: uncorrelated,
      numSimulations: 10000,
    })

    const { outcomes: corrOutcomes } = runMonteCarloSimulation({
      holdings,
      correlationMatrix: correlated,
      numSimulations: 10000,
    })

    // 5th percentile (VaR) — correlated should be worse (more negative)
    const uncorrVaR = uncorrOutcomes[Math.floor(0.05 * uncorrOutcomes.length)]
    const corrVaR = corrOutcomes[Math.floor(0.05 * corrOutcomes.length)]

    expect(corrVaR).toBeLessThan(uncorrVaR)
  })
})

describe('runPortfolioStressTest', () => {
  it('produces valid StressTestResult structure', () => {
    const holdings = [
      { ticker: 'ZAG', holdingValueCad: 7600, expectedReturn: -0.02, volatility: 0.018 },
      { ticker: 'XIC', holdingValueCad: 8200, expectedReturn: -0.01, volatility: 0.023 },
    ]
    const correlationMatrix = [
      [1.0, 0.31],
      [0.31, 1.0],
    ]

    const result = runPortfolioStressTest({
      holdings,
      correlationMatrix,
      numSimulations: 5000,
    })

    expect(result.numSimulations).toBe(5000)
    expect(result.reversalProbability).toBeGreaterThanOrEqual(0)
    expect(result.reversalProbability).toBeLessThanOrEqual(1)

    // Downside should be worse (more negative) than base case
    expect(result.downside.mid).toBeLessThanOrEqual(result.baseCase.mid)
    expect(result.tailRisk.mid).toBeLessThanOrEqual(result.downside.mid)

    // Scenarios should be present
    expect(result.scenarios).toHaveLength(3)

    // Holding breakdown should cover all holdings
    expect(result.holdingBreakdown).toHaveLength(2)
    expect(result.holdingBreakdown[0].ticker).toBe('ZAG')
    expect(result.holdingBreakdown[1].ticker).toBe('XIC')
  })

  it('guarantees low <= mid <= high for all scenarios', () => {
    const holdings = [
      { ticker: 'ZAG', holdingValueCad: 7600, expectedReturn: -0.02, volatility: 0.018 },
      { ticker: 'XIC', holdingValueCad: 8200, expectedReturn: -0.01, volatility: 0.023 },
    ]
    const result = runPortfolioStressTest({
      holdings,
      correlationMatrix: [[1.0, 0.31], [0.31, 1.0]],
      numSimulations: 5000,
    })

    for (const scenario of [result.baseCase, result.downside, result.tailRisk]) {
      expect(scenario.low).toBeLessThanOrEqual(scenario.mid)
      expect(scenario.mid).toBeLessThanOrEqual(scenario.high)
    }
  })

  it('base case is between downside and tail risk', () => {
    const holdings = [
      { ticker: 'VFV', holdingValueCad: 12400, expectedReturn: -0.015, volatility: 0.025 },
    ]
    const result = runPortfolioStressTest({
      holdings,
      correlationMatrix: [[1]],
      numSimulations: 5000,
    })

    // Base case mid should be between tail risk mid and 0
    expect(result.baseCase.mid).toBeGreaterThanOrEqual(result.tailRisk.mid)
  })

  it('reversal probability is reasonable for negative expected return', () => {
    const holdings = [
      { ticker: 'ZAG', holdingValueCad: 7600, expectedReturn: -0.03, volatility: 0.02 },
    ]
    const result = runPortfolioStressTest({
      holdings,
      correlationMatrix: [[1]],
      numSimulations: 10000,
    })

    // With -3% expected return and 2% vol, reversal should be small but non-zero
    expect(result.reversalProbability).toBeGreaterThan(0)
    expect(result.reversalProbability).toBeLessThan(0.5)
  })
})
