import { describe, it, expect } from 'vitest'
import {
  classifyInteraction,
  computeNetImpact,
  aggregateHoldingImpacts,
  computePortfolioImpact,
} from '../cross-signal-synthesizer'
import type { Signal, FundManagerVerdict, DollarRange } from '@prism/shared'

// ── Helpers ──────────────────────────────────────────────────

function makeContribution(signalId: string, mid: number, spread = 50) {
  return {
    signalId,
    impact: { low: mid + spread, mid, high: mid - spread } as DollarRange,
  }
}

function makeSignal(id: string, headline: string): Signal {
  return {
    id,
    headline,
    description: `Description for ${id}`,
    affectedExposures: ['Canadian Financials'],
    relevanceScore: 0.8,
    urgency: 'high' as const,
    sentiment: 'negative' as const,
    temporalClassification: 'structural' as const,
    sources: [],
    detectedAt: '2025-01-15T14:00:00Z',
    acknowledged: false,
  }
}

function makeVerdict(signalId: string, holdings: { ticker: string; name: string; mid1M: number }[]): FundManagerVerdict {
  return {
    signalId,
    holdingImpacts: holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      holdingValueCad: 5000,
      direction: h.mid1M < 0 ? -0.5 : 0.5,
      impact: {
        '1M': { low: h.mid1M * 0.7, mid: h.mid1M, high: h.mid1M * 1.3 },
      },
      confidence: 0.7,
      derivation: 'Test derivation',
    })),
    recommendations: [
      { id: 'do-nothing', title: 'Do nothing', description: 'Accept risk.', estimatedCost: '$0', riskReduction: 'None', tradeoffs: ['No cost'], isDoNothing: true },
    ],
    riskAdjustments: {
      confidenceHaircut: -0.15,
      magnitudeBoundsApplied: [],
      scenarioPreference: 'base',
    },
    perspectiveBreakdown: {
      bullCase: 'Bull case.',
      bearCase: 'Bear case.',
      unresolvedDisagreements: [],
    },
    qualityScore: 0.72,
    humanDecisionRequired: true,
  }
}

// ── classifyInteraction ─────────────────────────────────────

describe('classifyInteraction', () => {
  it('returns independent for single contribution', () => {
    const result = classifyInteraction([makeContribution('sig-1', -100)])
    expect(result).toBe('independent')
  })

  it('returns independent for empty contributions', () => {
    const result = classifyInteraction([])
    expect(result).toBe('independent')
  })

  it('returns offsetting when contributions have opposite directions', () => {
    const result = classifyInteraction([
      makeContribution('sig-1', -200),
      makeContribution('sig-2', 150),
    ])
    expect(result).toBe('offsetting')
  })

  it('returns compounding when all contributions go same direction', () => {
    const result = classifyInteraction([
      makeContribution('sig-1', -200),
      makeContribution('sig-2', -150),
    ])
    expect(result).toBe('compounding')
  })

  it('returns compounding for all positive contributions', () => {
    const result = classifyInteraction([
      makeContribution('sig-1', 100),
      makeContribution('sig-2', 200),
    ])
    expect(result).toBe('compounding')
  })
})

// ── computeNetImpact ────────────────────────────────────────

describe('computeNetImpact', () => {
  it('sums directly for independent interactions', () => {
    const contributions = [makeContribution('sig-1', -200, 50)]
    const result = computeNetImpact(contributions, 'independent')

    expect(result.low).toBe(-150) // -200 + 50
    expect(result.mid).toBe(-200)
    expect(result.high).toBe(-250) // -200 - 50
  })

  it('narrows range for offsetting interactions', () => {
    const contributions = [
      makeContribution('sig-1', -200, 50),
      makeContribution('sig-2', 150, 30),
    ]
    const result = computeNetImpact(contributions, 'offsetting')

    // midSum = -200 + 150 = -50
    expect(result.mid).toBe(-50)
    // Offsetting: low = min(lowSum, highSum), high = max(lowSum, highSum)
    // lowSum = -150 + 180 = 30, highSum = -250 + 120 = -130
    expect(result.low).toBe(Math.min(30, -130))
    expect(result.high).toBe(Math.max(30, -130))
  })

  it('widens range for compounding interactions', () => {
    const contributions = [
      makeContribution('sig-1', -200, 50),
      makeContribution('sig-2', -150, 30),
    ]
    const result = computeNetImpact(contributions, 'compounding')

    // midSum = -350
    expect(result.mid).toBe(-350)
    // lowSum = -150 + -120 = -270, highSum = -250 + -180 = -430
    // spread = |(-430) - (-270)| * 0.25 = 40
    // low = min(-270, -430) - 40 = -470
    // high = max(-270, -430) + 40 = -230
    expect(result.low).toBe(-470)
    expect(result.high).toBe(-230)
  })
})

// ── aggregateHoldingImpacts ─────────────────────────────────

describe('aggregateHoldingImpacts', () => {
  it('groups holdings across signals', () => {
    const signalVerdicts = [
      {
        signal: makeSignal('sig-rate', 'Rate hike'),
        verdict: makeVerdict('sig-rate', [
          { ticker: 'RY', name: 'Royal Bank', mid1M: -200 },
          { ticker: 'ZAG', name: 'BMO Bond', mid1M: -100 },
        ]),
      },
      {
        signal: makeSignal('sig-oil', 'Oil price drop'),
        verdict: makeVerdict('sig-oil', [
          { ticker: 'RY', name: 'Royal Bank', mid1M: 80 },
          { ticker: 'ENB', name: 'Enbridge', mid1M: -300 },
        ]),
      },
    ]

    const result = aggregateHoldingImpacts(signalVerdicts)

    expect(result).toHaveLength(3) // RY, ZAG, ENB

    const ry = result.find((h) => h.holdingTicker === 'RY')!
    expect(ry.signalContributions).toHaveLength(2)
    expect(ry.interaction).toBe('offsetting') // -200 and +80

    const zag = result.find((h) => h.holdingTicker === 'ZAG')!
    expect(zag.signalContributions).toHaveLength(1)
    expect(zag.interaction).toBe('independent')

    const enb = result.find((h) => h.holdingTicker === 'ENB')!
    expect(enb.signalContributions).toHaveLength(1)
    expect(enb.interaction).toBe('independent')
  })

  it('detects compounding signals on same holding', () => {
    const signalVerdicts = [
      {
        signal: makeSignal('sig-1', 'Signal 1'),
        verdict: makeVerdict('sig-1', [{ ticker: 'ZAG', name: 'BMO Bond', mid1M: -100 }]),
      },
      {
        signal: makeSignal('sig-2', 'Signal 2'),
        verdict: makeVerdict('sig-2', [{ ticker: 'ZAG', name: 'BMO Bond', mid1M: -150 }]),
      },
    ]

    const result = aggregateHoldingImpacts(signalVerdicts)
    const zag = result.find((h) => h.holdingTicker === 'ZAG')!

    expect(zag.interaction).toBe('compounding')
    expect(zag.signalContributions).toHaveLength(2)
  })

  it('computes net < gross for offsetting signals', () => {
    const signalVerdicts = [
      {
        signal: makeSignal('sig-1', 'Negative signal'),
        verdict: makeVerdict('sig-1', [{ ticker: 'RY', name: 'Royal Bank', mid1M: -300 }]),
      },
      {
        signal: makeSignal('sig-2', 'Positive signal'),
        verdict: makeVerdict('sig-2', [{ ticker: 'RY', name: 'Royal Bank', mid1M: 200 }]),
      },
    ]

    const result = aggregateHoldingImpacts(signalVerdicts)
    const ry = result.find((h) => h.holdingTicker === 'RY')!

    expect(ry.interaction).toBe('offsetting')
    // Net mid = -300 + 200 = -100, gross mid = 300 + 200 = 500
    expect(Math.abs(ry.netImpact.mid)).toBeLessThan(ry.grossImpact.mid)
  })
})

// ── computePortfolioImpact ──────────────────────────────────

describe('computePortfolioImpact', () => {
  it('sums net and gross across all holdings', () => {
    const holdingNetImpacts: HoldingNetImpact[] = [
      {
        holdingTicker: 'RY',
        holdingName: 'Royal Bank',
        signalContributions: [],
        interaction: 'offsetting',
        netImpact: { low: -50, mid: -100, high: -150 },
        grossImpact: { low: 200, mid: 400, high: 600 },
      },
      {
        holdingTicker: 'ZAG',
        holdingName: 'BMO Bond',
        signalContributions: [],
        interaction: 'independent',
        netImpact: { low: -30, mid: -60, high: -90 },
        grossImpact: { low: 30, mid: 60, high: 90 },
      },
    ]

    const { net, gross } = computePortfolioImpact(holdingNetImpacts)

    expect(net.mid).toBe(-160)
    expect(gross.mid).toBe(460)
    expect(net.low).toBe(-80)
    expect(gross.low).toBe(230)
  })

  it('returns zeros for empty holdings', () => {
    const { net, gross } = computePortfolioImpact([])

    expect(net).toEqual({ low: 0, mid: 0, high: 0 })
    expect(gross).toEqual({ low: 0, mid: 0, high: 0 })
  })
})

import type { HoldingNetImpact } from '@prism/shared'
