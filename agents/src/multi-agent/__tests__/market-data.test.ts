import { describe, it, expect } from 'vitest'
import { _testing } from '../market-data'

const {
  computeLogReturns,
  standardDeviation,
  pearsonCorrelation,
  computeVolatilityFromPrices,
  computeCorrelationMatrixFromReturns,
} = _testing

describe('computeLogReturns', () => {
  it('should compute log returns from price data', () => {
    const prices = [
      { date: '2024-01-01', open: 100, high: 105, low: 99, close: 100, volume: 1000 },
      { date: '2024-01-02', open: 100, high: 110, low: 98, close: 105, volume: 1000 },
      { date: '2024-01-03', open: 105, high: 108, low: 103, close: 103, volume: 1000 },
    ]
    const returns = computeLogReturns(prices)
    expect(returns).toHaveLength(2)
    expect(returns[0]).toBeCloseTo(Math.log(105 / 100), 5)
    expect(returns[1]).toBeCloseTo(Math.log(103 / 105), 5)
  })

  it('should handle single price (no returns)', () => {
    const prices = [
      { date: '2024-01-01', open: 100, high: 105, low: 99, close: 100, volume: 1000 },
    ]
    expect(computeLogReturns(prices)).toHaveLength(0)
  })
})

describe('standardDeviation', () => {
  it('should compute standard deviation correctly', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9]
    const sd = standardDeviation(values)
    expect(sd).toBeCloseTo(2.138, 2)
  })

  it('should return 0 for single value', () => {
    expect(standardDeviation([5])).toBe(0)
  })

  it('should return 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0)
  })
})

describe('pearsonCorrelation', () => {
  it('should return 1.0 for perfectly correlated data', () => {
    const x = [1, 2, 3, 4, 5]
    const y = [2, 4, 6, 8, 10]
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1.0, 5)
  })

  it('should return -1.0 for perfectly inversely correlated data', () => {
    const x = [1, 2, 3, 4, 5]
    const y = [10, 8, 6, 4, 2]
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1.0, 5)
  })

  it('should return near 0 for uncorrelated data', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8]
    const y = [3, 1, 4, 1, 5, 9, 2, 6] // More samples, less correlated
    const corr = pearsonCorrelation(x, y)
    expect(Math.abs(corr)).toBeLessThan(0.6)
  })

  it('should return 0 for insufficient data', () => {
    expect(pearsonCorrelation([1, 2], [3, 4])).toBe(0)
  })
})

describe('computeCorrelationMatrixFromReturns', () => {
  it('should produce symmetric matrix with 1.0 diagonal', () => {
    const returns = [
      [0.01, -0.02, 0.03, 0.01, -0.01],
      [0.02, -0.01, 0.02, 0.02, -0.02],
      [-0.01, 0.03, -0.02, -0.01, 0.02],
    ]
    const matrix = computeCorrelationMatrixFromReturns(returns)

    // Diagonal should be 1.0
    for (let i = 0; i < 3; i++) {
      expect(matrix[i][i]).toBeCloseTo(1.0, 5)
    }

    // Should be symmetric
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 5)
      }
    }
  })

  it('should handle single ticker', () => {
    const returns = [[0.01, -0.02, 0.03]]
    const matrix = computeCorrelationMatrixFromReturns(returns)
    expect(matrix).toEqual([[1.0]])
  })
})

describe('computeVolatilityFromPrices', () => {
  it('should compute volatility from price data', () => {
    // Generate simple price series: 100, 101, 99, 102, 98, 103...
    const prices = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      open: 100 + Math.sin(i) * 3,
      high: 100 + Math.sin(i) * 3 + 1,
      low: 100 + Math.sin(i) * 3 - 1,
      close: 100 + Math.sin(i) * 3,
      volume: 1000,
    }))

    const vol = computeVolatilityFromPrices(prices)
    expect(vol.daily).toBeGreaterThan(0)
    expect(vol.monthly).toBeGreaterThan(vol.daily)
    expect(vol.annualized).toBeGreaterThan(vol.monthly)
    // Monthly = daily * sqrt(21)
    expect(vol.monthly).toBeCloseTo(vol.daily * Math.sqrt(21), 5)
  })
})
