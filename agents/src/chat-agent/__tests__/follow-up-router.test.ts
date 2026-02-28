import { describe, it, expect } from 'vitest'
import {
  classifyByPattern,
  buildPortfolioSummary,
  buildVerdictSummary,
  buildFollowUpContext,
} from '../follow-up-router'
import type { Signal, FundManagerVerdict, Portfolio, UserProfile } from '@prism/shared'

// ── Test Data ───────────────────────────────────────────────

const mockSignal: Signal = {
  id: 'sig-rate-1',
  headline: 'BOC raises rates by 25bps',
  description: 'Bank of Canada raises overnight rate',
  affectedExposures: ['Canadian Financials'],
  relevanceScore: 0.85,
  urgency: 'high',
  sentiment: 'negative',
  temporalClassification: 'structural',
  sources: [{ title: 'Reuters', url: 'https://reuters.com' }],
  detectedAt: '2025-01-15T14:00:00Z',
  acknowledged: false,
}

const mockVerdict: FundManagerVerdict = {
  signalId: 'sig-rate-1',
  holdingImpacts: [
    {
      ticker: 'RY',
      name: 'Royal Bank',
      holdingValueCad: 5000,
      direction: -0.6,
      impact: { '1M': { low: -100, mid: -200, high: -350 } },
      confidence: 0.7,
      derivation: 'Test',
    },
    {
      ticker: 'ZAG',
      name: 'BMO Bond',
      holdingValueCad: 3000,
      direction: -0.4,
      impact: { '1M': { low: -30, mid: -60, high: -100 } },
      confidence: 0.65,
      derivation: 'Test',
    },
  ],
  recommendations: [
    { id: 'do-nothing', title: 'Do nothing', description: 'Accept.', estimatedCost: '$0', riskReduction: 'None', tradeoffs: ['No cost'], isDoNothing: true },
    { id: 'hedge', title: 'Hedge', description: 'Reduce exposure.', estimatedCost: '$50', riskReduction: '$100', tradeoffs: ['Cost'], isDoNothing: false },
  ],
  riskAdjustments: { confidenceHaircut: -0.15, magnitudeBoundsApplied: [], scenarioPreference: 'base' },
  perspectiveBreakdown: { bullCase: 'Banks adapt.', bearCase: 'NIM compression.', unresolvedDisagreements: [] },
  qualityScore: 0.72,
  humanDecisionRequired: true,
}

const mockPortfolio: Portfolio = {
  userId: 'user-1',
  asOf: '2025-01-15',
  accounts: [{
    accountId: 'acct-1',
    accountType: 'TFSA',
    holdings: [
      { ticker: 'RY', name: 'Royal Bank', units: 10, priceCad: 500, valueCad: 5000 },
      { ticker: 'ZAG', name: 'BMO Bond', units: 30, priceCad: 100, valueCad: 3000 },
      { ticker: 'VFV', name: 'Vanguard S&P 500', units: 20, priceCad: 100, valueCad: 2000 },
    ],
  }],
}

const mockUserProfile: UserProfile = {
  id: 'user-1',
  name: 'Test User',
  age: 35,
  investorType: 'growth',
  riskTolerance: 'moderate',
  investmentHorizon: '10+ years',
}

// ── classifyByPattern ───────────────────────────────────────

describe('classifyByPattern', () => {
  it('classifies drill-down queries', () => {
    expect(classifyByPattern('Tell me more about the bond impact')).toBe('drill_down')
    expect(classifyByPattern('Explain the RY derivation')).toBe('drill_down')
    expect(classifyByPattern('Show me the breakdown of assumptions')).toBe('drill_down')
    expect(classifyByPattern('Why does the impact change at 6M?')).toBe('drill_down')
  })

  it('classifies what-if assumption queries', () => {
    expect(classifyByPattern('What if 50bps instead of 25bps?')).toBe('what_if_assumption')
    expect(classifyByPattern('What happens if rates are cut instead?')).toBe('what_if_assumption')
    expect(classifyByPattern('Suppose inflation stays at 3%')).toBe('what_if_assumption')
    expect(classifyByPattern('If the rate hike is 75bps')).toBe('what_if_assumption')
  })

  it('classifies what-if portfolio queries', () => {
    expect(classifyByPattern('What if I sold ZAG?')).toBe('what_if_portfolio')
    expect(classifyByPattern('If I buy more VFV')).toBe('what_if_portfolio')
    expect(classifyByPattern('What if I added gold to my portfolio?')).toBe('what_if_portfolio')
  })

  it('classifies comparison queries', () => {
    expect(classifyByPattern('How does this compare to the oil signal?')).toBe('comparison')
    expect(classifyByPattern('Compare the rate hike vs tariff impact')).toBe('comparison')
    expect(classifyByPattern('What is the difference between these signals?')).toBe('comparison')
  })

  it('classifies new signal queries', () => {
    expect(classifyByPattern('What about the tariff announcement?')).toBe('new_signal')
    expect(classifyByPattern('Have you seen the earnings report?')).toBe('new_signal')
  })

  it('returns null for ambiguous queries', () => {
    expect(classifyByPattern('Hello')).toBeNull()
    expect(classifyByPattern('Thank you')).toBeNull()
    expect(classifyByPattern('What time is it?')).toBeNull()
  })
})

// ── buildPortfolioSummary ───────────────────────────────────

describe('buildPortfolioSummary', () => {
  it('computes total value and holding count', () => {
    const summary = buildPortfolioSummary(mockPortfolio)
    expect(summary.totalValueCad).toBe(10000)
    expect(summary.holdingCount).toBe(3)
  })

  it('returns top holdings sorted by value', () => {
    const summary = buildPortfolioSummary(mockPortfolio)
    expect(summary.topHoldings[0].ticker).toBe('RY')
    expect(summary.topHoldings[0].valueCad).toBe(5000)
    expect(summary.topHoldings[0].pct).toBe(50)
  })
})

// ── buildVerdictSummary ─────────────────────────────────────

describe('buildVerdictSummary', () => {
  it('computes impact range from 1M horizons', () => {
    const summary = buildVerdictSummary(mockVerdict, mockSignal)
    expect(summary.impactRange.low).toBe(-130) // -100 + -30
    expect(summary.impactRange.mid).toBe(-260) // -200 + -60
    expect(summary.impactRange.high).toBe(-450) // -350 + -100
  })

  it('includes signal metadata', () => {
    const summary = buildVerdictSummary(mockVerdict, mockSignal)
    expect(summary.signalId).toBe('sig-rate-1')
    expect(summary.signalHeadline).toBe('BOC raises rates by 25bps')
    expect(summary.qualityScore).toBe(0.72)
    expect(summary.recommendationCount).toBe(2)
  })

  it('sorts top impacts by absolute magnitude', () => {
    const summary = buildVerdictSummary(mockVerdict, mockSignal)
    expect(summary.topImpacts[0].ticker).toBe('RY') // -200 > -60
    expect(summary.topImpacts[1].ticker).toBe('ZAG')
  })
})

// ── buildFollowUpContext ────────────────────────────────────

describe('buildFollowUpContext', () => {
  it('builds context with all required fields', () => {
    const context = buildFollowUpContext({
      signal: mockSignal,
      portfolio: mockPortfolio,
      userProfile: mockUserProfile,
      verdict: mockVerdict,
    })

    expect(context.signal.id).toBe('sig-rate-1')
    expect(context.portfolioSummary.totalValueCad).toBe(10000)
    expect(context.verdictSummary.impactRange.mid).toBe(-260)
    expect(context.userProfile.id).toBe('user-1')
  })

  it('limits recent messages to last 10', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }))

    const context = buildFollowUpContext({
      signal: mockSignal,
      portfolio: mockPortfolio,
      userProfile: mockUserProfile,
      verdict: mockVerdict,
      recentMessages: messages,
    })

    expect(context.recentMessages).toHaveLength(10)
    expect(context.recentMessages[0].content).toBe('Message 5') // Starts from index 5
  })

  it('includes optional other verdicts', () => {
    const context = buildFollowUpContext({
      signal: mockSignal,
      portfolio: mockPortfolio,
      userProfile: mockUserProfile,
      verdict: mockVerdict,
      otherVerdicts: [{ signal: mockSignal, verdict: mockVerdict }],
    })

    expect(context.otherVerdicts).toHaveLength(1)
    expect(context.otherVerdicts![0].signalId).toBe('sig-rate-1')
  })
})
