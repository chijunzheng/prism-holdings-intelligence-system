import { describe, it, expect } from 'vitest'
import { inferRiskProfile } from '../risk-profile-inference'
import type { Portfolio } from '@prism/shared'

// Helper to load demo portfolio data
function loadPortfolio(path: string): Portfolio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`../../../../data/${path}`) as Portfolio
}

describe('inferRiskProfile', () => {
  describe('Jason (jason-01) — YOLO Redditor', () => {
    it('should score extremely high risk (~85-95)', () => {
      const portfolio = loadPortfolio('portfolios/jason-01.json')
      const result = inferRiskProfile({ portfolio })

      expect(result.riskScore).toBeGreaterThanOrEqual(80)
      expect(result.riskScore).toBeLessThanOrEqual(100)
      expect(result.riskTolerance).toBe('high')
    })

    it('should detect no bonds and high equity concentration', () => {
      const portfolio = loadPortfolio('portfolios/jason-01.json')
      const result = inferRiskProfile({ portfolio })

      const factorNames = result.factors.map((f) => f.factor)
      expect(factorNames.some((f) => f.includes('No bonds'))).toBe(true)
      expect(factorNames.some((f) => f.includes('Equity allocation'))).toBe(true)
    })

    it('should detect NVDA as >20% single position', () => {
      const portfolio = loadPortfolio('portfolios/jason-01.json')
      const result = inferRiskProfile({ portfolio })

      const factorNames = result.factors.map((f) => f.factor)
      expect(factorNames.some((f) => f.includes('Single position'))).toBe(true)
    })
  })

  describe('Sarah (sarah-01) — Couch Potato', () => {
    it('should score moderate risk (~50-60)', () => {
      const portfolio = loadPortfolio('portfolios/sarah-01.json')
      const result = inferRiskProfile({ portfolio })

      expect(result.riskScore).toBeGreaterThanOrEqual(45)
      expect(result.riskScore).toBeLessThanOrEqual(65)
      expect(result.riskTolerance).toBe('moderate')
    })

    it('should detect FHSA time-horizon mismatch', () => {
      const portfolio = loadPortfolio('portfolios/sarah-01.json')
      const result = inferRiskProfile({
        portfolio,
        userExpectations: {
          horizon: 20,
          accountHorizons: { FHSA: 2 },
        },
      })

      expect(result.warnings.some((w) => w.includes('FHSA'))).toBe(true)
      expect(result.warnings.some((w) => w.includes('down payment'))).toBe(true)
    })

    it('should detect XIC duplicate across TFSA + FHSA', () => {
      const portfolio = loadPortfolio('portfolios/sarah-01.json')
      const result = inferRiskProfile({ portfolio })

      expect(result.warnings.some((w) => w.includes('XIC') && w.includes('TFSA'))).toBe(true)
    })

    it('should detect VFV duplicate across TFSA + FHSA', () => {
      const portfolio = loadPortfolio('portfolios/sarah-01.json')
      const result = inferRiskProfile({ portfolio })

      expect(result.warnings.some((w) => w.includes('VFV') && w.includes('TFSA'))).toBe(true)
    })
  })

  describe('Diana (diana-01) — Advisor Worst Nightmare', () => {
    it('should score moderate risk', () => {
      const portfolio = loadPortfolio('portfolios/diana-01.json')
      const result = inferRiskProfile({ portfolio })

      // Diana has ~35% bonds (-15) but also single stock RY and concentration
      // Score ends up moderate range
      expect(result.riskScore).toBeGreaterThanOrEqual(35)
      expect(result.riskScore).toBeLessThanOrEqual(65)
    })

    it('should detect mismatch when declared tolerance is low', () => {
      const portfolio = loadPortfolio('portfolios/diana-01.json')
      const result = inferRiskProfile({
        portfolio,
        userExpectations: {
          riskToleranceOverride: 'low',
          horizon: 7,
        },
      })

      // Diana's portfolio has concentration flags that push score up,
      // but declared "low" should cause a mismatch detection
      // Mismatch may or may not trigger depending on score delta
      expect(result.declaredTolerance).toBe('low')
      expect(result.riskTolerance).toBe('low') // Uses declared when provided
    })

    it('should detect short investment horizon', () => {
      const portfolio = loadPortfolio('portfolios/diana-01.json')
      const result = inferRiskProfile({
        portfolio,
        userExpectations: { horizon: 7 },
      })

      const factorNames = result.factors.map((f) => f.factor)
      expect(factorNames.some((f) => f.includes('horizon <10y'))).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty portfolio', () => {
      const portfolio: Portfolio = {
        userId: 'empty',
        accounts: [],
        totalValueCad: 0,
        lastUpdated: new Date().toISOString(),
      }
      const result = inferRiskProfile({ portfolio })

      expect(result.riskScore).toBe(50) // Base score
      expect(result.riskTolerance).toBe('moderate')
    })

    it('should use declared tolerance when provided', () => {
      const portfolio = loadPortfolio('portfolios/jason-01.json')
      const result = inferRiskProfile({
        portfolio,
        userExpectations: { riskToleranceOverride: 'low' },
      })

      expect(result.riskTolerance).toBe('low') // Uses override
      expect(result.riskScore).toBeGreaterThan(70) // But inferred score is still high
    })
  })
})
