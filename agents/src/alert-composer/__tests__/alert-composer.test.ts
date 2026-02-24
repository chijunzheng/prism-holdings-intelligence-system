import { describe, it, expect, beforeEach } from 'vitest'
import type { CausalChain, UserProfile } from '@prism/shared'
import type { TemporalAnalysis } from '../../temporal-reasoner'
import { compose } from '../index'
import { resetAlertFrequencyState } from '../frequency'
import { createPersonalizationEngine } from '../../personalization'

const PROFILE_BALANCED: UserProfile = {
  id: 'sarah-01',
  name: 'Sarah',
  age: 42,
  riskTolerance: 'moderate',
  financialLiteracy: 'moderate',
  goals: ['Retirement at 62'],
  investmentHorizonYears: 20,
  context: 'Balanced investor',
  preferences: {
    maxDailyAlerts: 2,
    detailLevel: 'moderate',
  },
}

const PROFILE_LOW_RISK: UserProfile = {
  ...PROFILE_BALANCED,
  id: 'diana-01',
  name: 'Diana',
  age: 58,
  riskTolerance: 'low',
  financialLiteracy: 'low',
  investmentHorizonYears: 7,
  goals: ['Retirement in 7 years', 'Preserve capital'],
  preferences: {
    maxDailyAlerts: 1,
    detailLevel: 'simple',
  },
}

const PROFILE_HIGH_RISK: UserProfile = {
  ...PROFILE_BALANCED,
  id: 'marcus-01',
  name: 'Marcus',
  age: 25,
  riskTolerance: 'high',
  financialLiteracy: 'high',
  investmentHorizonYears: 35,
  goals: ['Long-term growth'],
  preferences: {
    maxDailyAlerts: 3,
    detailLevel: 'detailed',
  },
}

function makeChain(chainId = 'chain-01'): CausalChain {
  return {
    id: chainId,
    signalId: 'sig-boc',
    generatedAt: '2026-02-24T12:00:00.000Z',
    nodes: [
      {
        id: 'n1',
        type: 'event',
        label: 'BoC guidance',
        description: 'Policy risk to lenders',
        confidence: 0.88,
        metadata: {},
      },
      {
        id: 'n2',
        type: 'asset',
        label: 'ZEB',
        description: 'Canadian bank ETF',
        confidence: 0.8,
        dollarImpact: -850,
        percentageImpact: -2.1,
        metadata: { ticker: 'ZEB' },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        magnitude: 0.7,
        direction: 'negative',
        confidence: 0.82,
        mechanism: 'Policy uncertainty pressures bank earnings',
      },
    ],
    summary: 'BoC policy uncertainty could weigh on Canadian bank earnings.',
    disclaimer: 'For informational purposes only.',
    maxHops: 2,
    isSpeculative: false,
  }
}

function makeTemporalAnalysis(overrides?: Partial<TemporalAnalysis>): TemporalAnalysis {
  return {
    classification: 'structural',
    confidence: 0.81,
    methodology: {
      historicalBaseRate: 'Similar policy shocks often persist.',
      signalClustering: 'Macro and credit signals are clustered.',
      structuralIndicators: 'Lending and policy mechanisms indicate persistence.',
      contextualSynthesis: 'Structural downside risk dominates.',
    },
    impactClassifications: [
      {
        nodeId: 'n2',
        assetLabel: 'ZEB',
        ticker: 'ZEB',
        dollarImpact: -850,
        classification: 'structural',
        confidence: 0.8,
        reasoning: 'Bank ETF sensitivity to policy regime shift.',
      },
    ],
    timeBuckets: {
      oneWeek: {
        direction: 'negative',
        expectedDollarImpact: -400,
        lowDollarImpact: -700,
        highDollarImpact: -200,
        confidence: 0.78,
      },
      oneMonth: {
        direction: 'negative',
        expectedDollarImpact: -850,
        lowDollarImpact: -1200,
        highDollarImpact: -500,
        confidence: 0.76,
      },
      sixMonth: {
        direction: 'negative',
        expectedDollarImpact: -1100,
        lowDollarImpact: -1700,
        highDollarImpact: -600,
        confidence: 0.7,
      },
    },
    recommendations: [
      {
        id: 'rec1',
        horizon: 'one_week',
        summary: 'Trim exposure near-term',
        rationale: 'Lower drawdown risk',
        tradeoffs: 'Might miss rebound',
        proposedShiftCad: 500,
      },
      {
        id: 'rec2',
        horizon: 'six_month',
        summary: 'Rotate to diversified holdings',
        rationale: 'Reduce structural concentration',
        tradeoffs: 'Potential opportunity cost',
        proposedShiftCad: 900,
      },
    ],
    tension: undefined,
    counterfactual: {
      scenario: 'If you had rebalanced 3 months ago...',
      estimatedOutcomeDifferenceCad: 420,
      explanation: 'Lower drawdown estimate.',
    },
    ...overrides,
  }
}

describe('Alert Composer + Personalization', () => {
  beforeEach(() => {
    resetAlertFrequencyState()
  })

  it('provides profile-specific materiality thresholds', () => {
    const engine = createPersonalizationEngine()
    expect(engine.getMaterialityThreshold(PROFILE_LOW_RISK).minPortfolioImpactPct).toBe(1)
    expect(engine.getMaterialityThreshold(PROFILE_BALANCED).minPortfolioImpactPct).toBe(2)
    expect(engine.getMaterialityThreshold(PROFILE_HIGH_RISK).minPortfolioImpactPct).toBe(5)
  })

  it('enforces frequency cap at max 2 alerts/day', async () => {
    const analysis = makeTemporalAnalysis()
    const options = { totalPortfolioValueCad: 20000, temporalAnalysis: analysis }

    const first = await compose(makeChain('chain-a'), PROFILE_BALANCED, options)
    const second = await compose(makeChain('chain-b'), PROFILE_BALANCED, options)
    const third = await compose(makeChain('chain-c'), PROFILE_BALANCED, options)

    expect(first.success && first.data?.shouldNotify).toBe(true)
    expect(second.success && second.data?.shouldNotify).toBe(true)
    expect(third.success && third.data?.shouldNotify).toBe(false)
    expect(third.data?.suppressedReason).toBe('frequency_cap')
  })

  it('suppresses duplicate chain alerts unless magnitude changes materially', async () => {
    const baseAnalysis = makeTemporalAnalysis()
    const chain = makeChain('chain-dup')

    const first = await compose(chain, PROFILE_BALANCED, {
      totalPortfolioValueCad: 20000,
      temporalAnalysis: baseAnalysis,
    })
    const duplicate = await compose(chain, PROFILE_BALANCED, {
      totalPortfolioValueCad: 20000,
      temporalAnalysis: baseAnalysis,
    })
    const changedMagnitude = await compose(chain, PROFILE_BALANCED, {
      totalPortfolioValueCad: 20000,
      temporalAnalysis: makeTemporalAnalysis({
        timeBuckets: {
          ...baseAnalysis.timeBuckets,
          oneMonth: {
            ...baseAnalysis.timeBuckets.oneMonth,
            expectedDollarImpact: -1300,
          },
        },
      }),
    })

    expect(first.success && first.data?.shouldNotify).toBe(true)
    expect(duplicate.success && duplicate.data?.shouldNotify).toBe(false)
    expect(duplicate.data?.suppressedReason).toBe('duplicate')
    expect(changedMagnitude.success && changedMagnitude.data?.shouldNotify).toBe(true)
  })

  it('adapts alert language tone by financial literacy level', async () => {
    const chain = makeChain('chain-tone')
    const analysis = makeTemporalAnalysis()

    const simple = await compose(chain, PROFILE_LOW_RISK, {
      totalPortfolioValueCad: 20000,
      temporalAnalysis: analysis,
    })
    const advanced = await compose(chain, PROFILE_HIGH_RISK, {
      totalPortfolioValueCad: 20000,
      temporalAnalysis: analysis,
    })

    expect(simple.success).toBe(true)
    expect(advanced.success).toBe(true)
    expect(simple.data!.body).not.toEqual(advanced.data!.body)
    expect(simple.data!.tone).toBe('simple')
    expect(advanced.data!.tone).toBe('advanced')
  })

  it('formats personalized signal-card alert payload', async () => {
    const result = await compose(makeChain('chain-card'), PROFILE_LOW_RISK, {
      totalPortfolioValueCad: 20000,
      temporalAnalysis: makeTemporalAnalysis(),
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.signalCard.headline.length).toBeGreaterThan(0)
    expect(result.data!.signalCard.classificationBadge).toBe('structural')
    expect(result.data!.signalCard.materialityIndicator).toMatch(/materiality/i)
    expect(result.data!.passesAdvisorCallTest).toBe(true)
  })
})
