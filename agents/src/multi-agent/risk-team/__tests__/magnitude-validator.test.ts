import { describe, it, expect } from 'vitest'
import { runMagnitudeValidator } from '../magnitude-validator'
import type { HoldingImpactEstimate, VolatilityData } from '@prism/shared'

describe('runMagnitudeValidator', () => {
  const baseImpact: HoldingImpactEstimate = {
    ticker: 'ZAG',
    name: 'BMO Aggregate Bond Index ETF',
    direction: -1,
    magnitudeScore: 0.03,
    confidence: 0.8,
  }

  const baseVol: VolatilityData = {
    daily: 0.004,
    monthly: 0.018,
    annualized: 0.062,
  }

  it('passes estimates within volatility bounds', () => {
    const result = runMagnitudeValidator({
      holdingImpacts: [baseImpact],
      volatilities: { ZAG: baseVol },
    })

    expect(result.holdingValidations).toHaveLength(1)
    expect(result.holdingValidations[0].outOfBounds).toBe(false)
    expect(result.outOfBoundsFlags).toHaveLength(0)
  })

  it('flags and clamps estimates exceeding 3x monthly volatility', () => {
    const highMagnitude: HoldingImpactEstimate = {
      ...baseImpact,
      magnitudeScore: 0.10, // 10% — exceeds 3 * 1.8% = 5.4%
    }

    const result = runMagnitudeValidator({
      holdingImpacts: [highMagnitude],
      volatilities: { ZAG: baseVol },
    })

    expect(result.holdingValidations[0].outOfBounds).toBe(true)
    expect(result.holdingValidations[0].calibratedMagnitude).toBeCloseTo(0.054, 3) // 3 * 0.018
    expect(result.outOfBoundsFlags).toHaveLength(1)
    expect(result.outOfBoundsFlags[0]).toContain('ZAG')
  })

  it('uses fallback volatility when data unavailable', () => {
    const result = runMagnitudeValidator({
      holdingImpacts: [baseImpact],
      volatilities: {}, // No volatility data
    })

    // ZAG is classified as fixed_income, fallback monthly vol = 2%
    expect(result.holdingValidations[0].historicalVolatility).toBe(0.02)
    expect(result.holdingValidations[0].outOfBounds).toBe(false) // 3% < 6% (3x bound)
  })

  it('classifies bond tickers correctly', () => {
    const bondImpact: HoldingImpactEstimate = {
      ...baseImpact,
      ticker: 'ZAG',
      magnitudeScore: 0.07, // 7% — exceeds 3 * 2% = 6% for bonds
    }

    const result = runMagnitudeValidator({
      holdingImpacts: [bondImpact],
      volatilities: {}, // No data — fallback to fixed_income: 2%
    })

    // ZAG is classified as fixed_income, fallback monthly vol = 2%
    // 3x bound = 6%, estimate = 7% → out of bounds
    expect(result.holdingValidations[0].historicalVolatility).toBe(0.02)
    expect(result.holdingValidations[0].outOfBounds).toBe(true)
  })

  it('handles multiple holdings', () => {
    const impacts: HoldingImpactEstimate[] = [
      { ...baseImpact, ticker: 'ZAG', magnitudeScore: 0.01 },
      { ...baseImpact, ticker: 'XIC', name: 'iShares Core S&P/TSX', magnitudeScore: 0.02 },
      { ...baseImpact, ticker: 'VFV', name: 'Vanguard S&P 500', magnitudeScore: 0.15 }, // High
    ]

    const vols: Record<string, VolatilityData> = {
      ZAG: baseVol,
      XIC: { daily: 0.011, monthly: 0.023, annualized: 0.079 },
      VFV: { daily: 0.012, monthly: 0.025, annualized: 0.086 },
    }

    const result = runMagnitudeValidator({
      holdingImpacts: impacts,
      volatilities: vols,
    })

    expect(result.holdingValidations).toHaveLength(3)
    // VFV: 15% exceeds 3 * 2.5% = 7.5%
    expect(result.holdingValidations[2].outOfBounds).toBe(true)
    expect(result.outOfBoundsFlags).toHaveLength(1)
  })

  it('provides meaningful overall assessment', () => {
    const result = runMagnitudeValidator({
      holdingImpacts: [baseImpact],
      volatilities: { ZAG: baseVol },
    })

    expect(result.overallAssessment).toContain('within historical volatility bounds')
  })

  it('falls back safely when volatility data contains non-finite numbers', () => {
    const result = runMagnitudeValidator({
      holdingImpacts: [baseImpact],
      volatilities: {
        ZAG: {
          daily: Number.NaN,
          monthly: Number.NaN,
          annualized: Number.NaN,
        } as unknown as VolatilityData,
      },
    })

    // ZAG fallback monthly volatility is 2%
    expect(result.holdingValidations[0].historicalVolatility).toBe(0.02)
    expect(result.holdingValidations[0].maxReasonableMove).toBe(0.06)
  })

  it('falls back safely when magnitude score is non-finite', () => {
    const invalidImpact = {
      ...baseImpact,
      magnitudeScore: Number.NaN,
    } as unknown as HoldingImpactEstimate

    const result = runMagnitudeValidator({
      holdingImpacts: [invalidImpact],
      volatilities: { ZAG: baseVol },
    })

    expect(result.holdingValidations[0].estimatedMagnitude).toBe(0)
    expect(result.holdingValidations[0].outOfBounds).toBe(false)
  })
})
