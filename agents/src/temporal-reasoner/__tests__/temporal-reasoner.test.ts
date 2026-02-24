import { describe, it, expect } from 'vitest'
import type { CausalChain, UserProfile } from '@prism/shared'
import { classify } from '../index'

const PROFILE_MODERATE: UserProfile = {
  id: 'sarah-01',
  name: 'Sarah',
  age: 42,
  riskTolerance: 'moderate',
  financialLiteracy: 'moderate',
  goals: ['Retirement at 62', "Children's education fund"],
  investmentHorizonYears: 20,
  context: 'Mid-career balanced investor',
  preferences: {
    maxDailyAlerts: 2,
    detailLevel: 'moderate',
  },
}

const PROFILE_LOW_RISK: UserProfile = {
  id: 'diana-01',
  name: 'Diana',
  age: 58,
  riskTolerance: 'low',
  financialLiteracy: 'moderate',
  goals: ['Retirement in 7 years', 'Preserve capital'],
  investmentHorizonYears: 7,
  context: 'Pre-retiree capital preservation',
  preferences: {
    maxDailyAlerts: 1,
    detailLevel: 'simple',
  },
}

function makeCompetingChain(): CausalChain {
  return {
    id: 'chain-competing',
    signalId: 'sig-boc-policy',
    generatedAt: '2026-02-24T12:00:00.000Z',
    nodes: [
      {
        id: 'n1',
        type: 'event',
        label: 'BoC policy guidance',
        description: 'Tighter lending guidance expected',
        confidence: 0.9,
        metadata: {},
      },
      {
        id: 'n2',
        type: 'mechanism',
        label: 'Mortgage growth slowdown',
        description: 'Banks face slower credit growth',
        confidence: 0.82,
        temporalClassification: 'structural',
        metadata: {},
      },
      {
        id: 'n3',
        type: 'sector',
        label: 'Canadian Banks',
        description: 'Potential earnings pressure',
        confidence: 0.78,
        metadata: {},
      },
      {
        id: 'n4',
        type: 'asset',
        label: 'ZEB',
        description: 'Bank ETF downside',
        confidence: 0.76,
        dollarImpact: -1200,
        percentageImpact: -3.0,
        metadata: { ticker: 'ZEB' },
      },
      {
        id: 'n5',
        type: 'mechanism',
        label: 'Safe-haven bid',
        description: 'Risk-off supports precious metals',
        confidence: 0.74,
        temporalClassification: 'transient',
        metadata: {},
      },
      {
        id: 'n6',
        type: 'sector',
        label: 'Gold Miners',
        description: 'Gold-linked equities can benefit',
        confidence: 0.7,
        metadata: {},
      },
      {
        id: 'n7',
        type: 'asset',
        label: 'XGD',
        description: 'Gold ETF upside',
        confidence: 0.71,
        dollarImpact: 450,
        percentageImpact: 2.0,
        metadata: { ticker: 'XGD' },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        magnitude: 0.8,
        direction: 'negative',
        confidence: 0.85,
        mechanism: 'Policy pressure reduces credit growth',
      },
      {
        id: 'e2',
        source: 'n2',
        target: 'n3',
        magnitude: 0.75,
        direction: 'negative',
        confidence: 0.82,
        mechanism: 'Lower loan demand hurts banks',
      },
      {
        id: 'e3',
        source: 'n3',
        target: 'n4',
        magnitude: 0.72,
        direction: 'negative',
        confidence: 0.8,
        mechanism: 'ZEB tracks major bank earnings',
      },
      {
        id: 'e4',
        source: 'n1',
        target: 'n5',
        magnitude: 0.6,
        direction: 'positive',
        confidence: 0.74,
        mechanism: 'Risk-off flow into gold',
      },
      {
        id: 'e5',
        source: 'n5',
        target: 'n6',
        magnitude: 0.58,
        direction: 'positive',
        confidence: 0.7,
        mechanism: 'Gold demand supports miners',
      },
      {
        id: 'e6',
        source: 'n6',
        target: 'n7',
        magnitude: 0.55,
        direction: 'positive',
        confidence: 0.68,
        mechanism: 'XGD benefits from higher bullion prices',
      },
    ],
    summary:
      'Near-term risk-off flows may support gold while tighter policy creates a structural drag on banks.',
    disclaimer: 'For informational purposes only.',
    maxHops: 3,
    isSpeculative: false,
  }
}

function makeLowConfidenceChain(): CausalChain {
  const chain = makeCompetingChain()
  return {
    ...chain,
    nodes: chain.nodes.map((node) => ({ ...node, confidence: 0.35 })),
    edges: chain.edges.map((edge) => ({ ...edge, confidence: 0.35 })),
    summary: 'Unclear market reaction with conflicting reports.',
  }
}

function makeSingleDirectionChain(): CausalChain {
  const chain = makeCompetingChain()
  return {
    ...chain,
    nodes: chain.nodes.filter((node) => node.id !== 'n5' && node.id !== 'n6' && node.id !== 'n7'),
    edges: chain.edges.filter((edge) => edge.id !== 'e4' && edge.id !== 'e5' && edge.id !== 'e6'),
    summary: 'Policy shift creates broad headwinds for Canadian banks.',
  }
}

describe('Temporal Reasoner', () => {
  it('returns structured temporal analysis with impact classifications', async () => {
    const result = await classify(makeCompetingChain(), PROFILE_MODERATE)
    expect(result.success).toBe(true)

    const analysis = result.data!
    expect(analysis.classification).toBeDefined()
    expect(analysis.methodology.contextualSynthesis.length).toBeGreaterThan(0)
    expect(analysis.impactClassifications.length).toBeGreaterThan(0)
    expect(analysis.timeBuckets.oneWeek.confidence).toBeGreaterThan(0)
    expect(analysis.timeBuckets.oneMonth.lowDollarImpact).toBeLessThanOrEqual(
      analysis.timeBuckets.oneMonth.highDollarImpact,
    )
    expect(analysis.timeBuckets.sixMonth.lowDollarImpact).toBeLessThanOrEqual(
      analysis.timeBuckets.sixMonth.highDollarImpact,
    )
  })

  it('defaults to ambiguous when confidence is below threshold', async () => {
    const result = await classify(makeLowConfidenceChain(), PROFILE_MODERATE)
    expect(result.success).toBe(true)
    expect(result.data!.classification).toBe('ambiguous')
    expect(result.data!.confidence).toBeLessThan(0.5)
  })

  it('surfaces tension for competing short vs long horizon views', async () => {
    const result = await classify(makeCompetingChain(), PROFILE_MODERATE)
    expect(result.success).toBe(true)
    expect(result.data!.tension).toBeDefined()
    expect(result.data!.recommendations.length).toBeGreaterThanOrEqual(2)
  })

  it('does not include tension when all impacts are one-directional', async () => {
    const result = await classify(makeSingleDirectionChain(), PROFILE_MODERATE)
    expect(result.success).toBe(true)
    expect(result.data!.tension).toBeUndefined()
  })

  it('includes concrete dollar amounts and user-context references in recommendations', async () => {
    const result = await classify(makeCompetingChain(), PROFILE_LOW_RISK)
    expect(result.success).toBe(true)

    const recommendationText = result.data!.recommendations
      .map((recommendation) => `${recommendation.summary} ${recommendation.rationale}`)
      .join(' ')

    expect(recommendationText).toMatch(/\$[0-9,]+/)
    expect(recommendationText).toContain('58')
    expect(recommendationText.toLowerCase()).toContain('low')
  })

  it('produces counterfactual analysis output', async () => {
    const result = await classify(makeCompetingChain(), PROFILE_MODERATE)
    expect(result.success).toBe(true)
    expect(result.data!.counterfactual).toBeDefined()
    expect(result.data!.counterfactual!.scenario).toContain('3 months ago')
  })
})
