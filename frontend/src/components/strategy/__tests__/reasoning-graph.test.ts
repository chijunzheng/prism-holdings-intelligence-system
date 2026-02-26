import { describe, expect, it } from 'vitest'
import type { CausalChain, Signal } from '@prism/shared'
import type { StrategyScenarioItem, TemporalAnalysis } from '../../../types/graph'
import { buildMitigationReasoningChain } from '../reasoning-graph'

const SIGNAL: Signal = {
  id: 'sig-oil',
  headline: 'Oil Prices Edge Higher Amid Geopolitical Tensions',
  description: 'Crude prices climbed as supply risk repriced energy and inflation expectations.',
  affectedExposures: ['Energy', 'Inflation', 'Consumer Discretionary'],
  relevanceScore: 0.81,
  urgency: 'high',
  temporalClassification: 'transient',
  sources: [{ title: 'Market Wire', url: 'https://example.com/sig-oil' }],
  detectedAt: '2026-02-26T10:00:00.000Z',
  acknowledged: false,
}

const TEMPORAL: TemporalAnalysis = {
  classification: 'transient',
  confidence: 0.74,
  totalPortfolioValueCad: 120000,
  timeBuckets: {
    oneWeek: {
      direction: 'negative',
      expectedDollarImpact: -220,
      lowDollarImpact: -320,
      highDollarImpact: -100,
      confidence: 0.66,
    },
    oneMonth: {
      direction: 'negative',
      expectedDollarImpact: -640,
      lowDollarImpact: -940,
      highDollarImpact: -280,
      confidence: 0.71,
    },
    sixMonth: {
      direction: 'ambiguous',
      expectedDollarImpact: -180,
      lowDollarImpact: -740,
      highDollarImpact: 340,
      confidence: 0.58,
    },
  },
  recommendations: [],
}

const SOURCE_CHAIN: CausalChain = {
  id: 'chain-oil',
  signalId: SIGNAL.id,
  generatedAt: '2026-02-26T10:00:00.000Z',
  nodes: [
    {
      id: 'event-oil',
      type: 'event',
      label: 'Oil supply shock',
      description: 'Upstream disruptions raise input costs.',
      confidence: 0.78,
      metadata: {},
    },
    {
      id: 'sector-energy',
      type: 'sector',
      label: 'Energy',
      description: 'Energy revenues rise while volatility increases.',
      confidence: 0.73,
      dollarImpact: -280,
      metadata: {},
    },
    {
      id: 'asset-retail',
      type: 'asset',
      label: 'Consumer Basket',
      description: 'Consumer discretionary margin pressure.',
      confidence: 0.69,
      dollarImpact: -360,
      metadata: {},
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'event-oil',
      target: 'sector-energy',
      magnitude: 0.72,
      direction: 'negative',
      confidence: 0.75,
      mechanism: 'Input-cost pass-through pressure.',
    },
  ],
  summary: 'Energy shock propagates to consumer-sensitive assets.',
  disclaimer: 'Informational only.',
  maxHops: 3,
  isSpeculative: false,
}

const SCENARIO_ITEMS: ReadonlyArray<StrategyScenarioItem> = [
  {
    candidateId: 'cand-zag',
    ticker: 'ZAG',
    name: 'BMO Aggregate Bond Index ETF',
    type: 'etf',
    rationale: 'Defensive fixed-income sleeve to offset downside in risk assets.',
    confidence: 0.79,
    expectedMitigationCad: 180,
    diversificationScore: 0.86,
    estimatedTurnoverCostCad: 16,
    estimatedTaxCostCad: 9,
    allocationPct: 1.5,
  },
  {
    candidateId: 'cand-cash',
    ticker: 'CASH',
    name: 'Cash Buffer',
    type: 'cash',
    rationale: 'Preserves optionality when confidence is low or signals conflict.',
    confidence: 0.74,
    expectedMitigationCad: 120,
    diversificationScore: 0.91,
    estimatedTurnoverCostCad: 4,
    estimatedTaxCostCad: 2,
    allocationPct: 1.0,
  },
]

describe('buildMitigationReasoningChain', () => {
  it('builds a causal chain with source, impact, thesis, and candidate nodes', () => {
    const chain = buildMitigationReasoningChain({
      signal: SIGNAL,
      sourceChain: SOURCE_CHAIN,
      scenarioItems: SCENARIO_ITEMS,
      temporalAnalysis: TEMPORAL,
    })

    expect(chain.nodes.some((node) => node.type === 'event')).toBe(true)
    expect(chain.nodes.some((node) => node.id === 'candidate-cand-zag')).toBe(true)
    expect(chain.nodes.some((node) => node.id === 'thesis-cand-zag')).toBe(true)
    expect(chain.edges.some((edge) => edge.source === 'source-signal')).toBe(true)
    expect(chain.edges.some((edge) => edge.target === 'candidate-cand-zag')).toBe(true)
  })

  it('falls back to signal exposure channels when no source chain is provided', () => {
    const chain = buildMitigationReasoningChain({
      signal: SIGNAL,
      sourceChain: null,
      scenarioItems: SCENARIO_ITEMS,
      temporalAnalysis: TEMPORAL,
    })

    const impactLabels = chain.nodes
      .filter((node) => node.type === 'mechanism')
      .map((node) => node.label)
    expect(impactLabels).toContain('Energy')
    expect(impactLabels).toContain('Inflation')
  })

  it('still builds a readable chain with empty scenario items', () => {
    const chain = buildMitigationReasoningChain({
      signal: SIGNAL,
      sourceChain: SOURCE_CHAIN,
      scenarioItems: [],
      temporalAnalysis: TEMPORAL,
    })

    expect(chain.nodes.some((node) => node.type === 'event')).toBe(true)
    expect(chain.nodes.some((node) => node.type === 'mechanism')).toBe(true)
    expect(chain.nodes.some((node) => node.type === 'asset')).toBe(false)
  })
})
