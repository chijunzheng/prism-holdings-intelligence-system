import { describe, it, expect } from 'vitest'
import { computeOverallQuality, computeFallbackVerdict } from '../judge'
import type { FundManagerVerdict } from '@prism/shared'

function makeVerdict(overrides: Partial<FundManagerVerdict> = {}): FundManagerVerdict {
  return {
    signalId: 'sig-1',
    holdingImpacts: [
      {
        ticker: 'RY',
        name: 'Royal Bank',
        holdingValueCad: 5000,
        direction: -0.6,
        impact: {
          '1W': { low: -50, mid: -80, high: -120 },
          '1M': { low: -100, mid: -200, high: -350 },
          '6M': { low: -200, mid: -500, high: -800 },
        },
        confidence: 0.7,
        derivation: '$5,000 × 60% magnitude × -0.60 direction. Vol: 4.2% monthly (Yahoo Finance). Haircut: -15%.',
      },
    ],
    recommendations: [
      { id: 'do-nothing', title: 'Do nothing', description: 'Accept risk', estimatedCost: '$0', riskReduction: 'None', tradeoffs: ['No cost'], isDoNothing: true },
      { id: 'light', title: 'Light', description: 'Reduce exposure', estimatedCost: '$200', riskReduction: '$80', tradeoffs: ['Lower cost'], isDoNothing: false },
    ],
    riskAdjustments: {
      confidenceHaircut: -0.15,
      magnitudeBoundsApplied: ['RY: clamped from 80.0% to 60.0%'],
      scenarioPreference: 'base',
    },
    perspectiveBreakdown: {
      bullCase: 'Canadian banks have strong capital buffers.',
      bearCase: 'Rate sensitivity could compress NIM significantly.',
      unresolvedDisagreements: ['Magnitude of NIM compression'],
    },
    qualityScore: 0.72,
    humanDecisionRequired: true,
    ...overrides,
  }
}

describe('computeOverallQuality', () => {
  it('returns weighted average of all dimensions', () => {
    const score = computeOverallQuality({
      evidenceGrounding: 1.0,
      assumptionQuality: 1.0,
      magnitudeCalibration: 1.0,
      internalConsistency: 1.0,
      completeness: 1.0,
    })
    expect(score).toBeCloseTo(1.0)
  })

  it('weights evidence grounding and magnitude calibration highest', () => {
    // Only evidence and magnitude at 1.0, rest at 0.0
    const score = computeOverallQuality({
      evidenceGrounding: 1.0,
      assumptionQuality: 0.0,
      magnitudeCalibration: 1.0,
      internalConsistency: 0.0,
      completeness: 0.0,
    })
    // 0.25 + 0.25 = 0.50
    expect(score).toBeCloseTo(0.50)
  })

  it('returns 0 when all dimensions are 0', () => {
    const score = computeOverallQuality({
      evidenceGrounding: 0,
      assumptionQuality: 0,
      magnitudeCalibration: 0,
      internalConsistency: 0,
      completeness: 0,
    })
    expect(score).toBe(0)
  })
})

describe('computeFallbackVerdict', () => {
  it('returns convergenceReached: true for a well-formed verdict', () => {
    const verdict = makeVerdict()
    const result = computeFallbackVerdict(verdict, ['RY'], ['RY'])

    expect(result.convergenceReached).toBe(true)
    expect(result.overallQualityScore).toBeGreaterThanOrEqual(0.65)
    expect(result.feedback).toBeUndefined()
  })

  it('scores evidence grounding based on derivation presence', () => {
    const verdict = makeVerdict({
      holdingImpacts: [
        {
          ticker: 'RY',
          name: 'Royal Bank',
          holdingValueCad: 5000,
          direction: -0.6,
          impact: { '1M': { low: -100, mid: -200, high: -300 } },
          confidence: 0.7,
          derivation: '', // Empty derivation
        },
      ],
    })
    const result = computeFallbackVerdict(verdict, ['RY'], ['RY'])
    expect(result.evidenceGrounding).toBeLessThan(0.5)
  })

  it('scores assumption quality low when no haircut applied', () => {
    const verdict = makeVerdict({
      riskAdjustments: {
        confidenceHaircut: 0, // No haircut
        magnitudeBoundsApplied: [],
        scenarioPreference: 'base',
      },
    })
    const result = computeFallbackVerdict(verdict, ['RY'], ['RY'])
    expect(result.assumptionQuality).toBeLessThanOrEqual(0.3)
  })

  it('scores magnitude calibration low for extreme impacts', () => {
    const verdict = makeVerdict({
      holdingImpacts: [
        {
          ticker: 'RY',
          name: 'Royal Bank',
          holdingValueCad: 5000,
          direction: -0.6,
          impact: { '1M': { low: -50000, mid: -150000, high: -300000 } }, // Extreme
          confidence: 0.7,
          derivation: '$5,000 × something × something. Vol: 4.2% monthly (Yahoo Finance). Haircut: -15%.',
        },
      ],
    })
    const result = computeFallbackVerdict(verdict, ['RY'], ['RY'])
    expect(result.magnitudeCalibration).toBeLessThanOrEqual(0.3)
  })

  it('scores completeness based on ticker coverage', () => {
    const verdict = makeVerdict() // Only covers RY
    const analystTickers = ['RY', 'ENB', 'TSLA'] // Analysts covered 3
    const result = computeFallbackVerdict(verdict, analystTickers, ['RY'])
    // Only 1/3 coverage
    expect(result.completeness).toBeCloseTo(1 / 3, 1)
  })

  it('provides feedback when quality is below threshold', () => {
    const verdict = makeVerdict({
      holdingImpacts: [],
      riskAdjustments: {
        confidenceHaircut: 0,
        magnitudeBoundsApplied: [],
        scenarioPreference: 'base',
      },
    })
    const result = computeFallbackVerdict(verdict, ['RY', 'ENB'], [])
    expect(result.convergenceReached).toBe(false)
    expect(result.feedback).toBeDefined()
  })
})
