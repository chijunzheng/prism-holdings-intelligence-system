import { describe, expect, it } from 'vitest'
import type { CausalChain } from '@prism/shared'
import type { TemporalAnalysis } from '../../../types/graph'
import { buildGraphTooltipModel } from '../tooltip-utils'

function buildChain(): CausalChain {
  return {
    id: 'chain-tooltip',
    signalId: 'sig-tooltip',
    generatedAt: '2026-02-26T00:00:00.000Z',
    summary: 'Tooltip test chain',
    disclaimer: 'For test only',
    maxHops: 3,
    isSpeculative: false,
    nodes: [
      { id: 'event', type: 'event', label: 'Event', description: 'Detected 3h ago', confidence: 0.8, metadata: {} },
      { id: 'mech-a', type: 'mechanism', label: 'Mechanism A', description: 'Detected 2h ago', confidence: 0.7, metadata: {} },
      { id: 'mech-b', type: 'mechanism', label: 'Mechanism B', description: 'Detected 5h ago', confidence: 0.72, metadata: {} },
      { id: 'sector', type: 'sector', label: 'US Technology', description: 'Sector channel', confidence: 0.75, metadata: {} },
      { id: 'asset-a', type: 'asset', label: 'NVDA', description: 'NVIDIA', confidence: 0.77, dollarImpact: 120, metadata: { ticker: 'NVDA' } },
      { id: 'asset-b', type: 'asset', label: 'MSFT', description: 'Microsoft', confidence: 0.74, dollarImpact: -60, metadata: { ticker: 'MSFT' } },
    ],
    edges: [
      { id: 'e1', source: 'event', target: 'mech-a', magnitude: 0.9, direction: 'positive', confidence: 0.8, mechanism: 'Event to A' },
      { id: 'e2', source: 'event', target: 'mech-b', magnitude: 0.6, direction: 'negative', confidence: 0.6, mechanism: 'Event to B' },
      { id: 'e3', source: 'mech-a', target: 'sector', magnitude: 0.8, direction: 'positive', confidence: 0.78, mechanism: 'A to sector' },
      { id: 'e4', source: 'mech-b', target: 'sector', magnitude: 0.5, direction: 'negative', confidence: 0.7, mechanism: 'B to sector' },
      { id: 'e5', source: 'sector', target: 'asset-a', magnitude: 0.85, direction: 'positive', confidence: 0.82, mechanism: 'Sector to NVDA' },
      { id: 'e6', source: 'sector', target: 'asset-b', magnitude: 0.6, direction: 'negative', confidence: 0.75, mechanism: 'Sector to MSFT' },
    ],
  }
}

function buildTemporalAnalysis(): TemporalAnalysis {
  return {
    classification: 'structural',
    confidence: 0.76,
    totalPortfolioValueCad: 40_000,
    timeBuckets: {
      oneWeek: {
        direction: 'positive',
        expectedDollarImpact: 140,
        lowDollarImpact: 80,
        highDollarImpact: 180,
        confidence: 0.68,
      },
      oneMonth: {
        direction: 'positive',
        expectedDollarImpact: 260,
        lowDollarImpact: 140,
        highDollarImpact: 360,
        confidence: 0.72,
      },
      sixMonth: {
        direction: 'positive',
        expectedDollarImpact: 410,
        lowDollarImpact: 230,
        highDollarImpact: 580,
        confidence: 0.66,
      },
    },
    recommendations: [],
  }
}

describe('buildGraphTooltipModel', () => {
  it('builds actionable details for sector nodes', () => {
    const chain = buildChain()
    const temporal = buildTemporalAnalysis()
    const sector = chain.nodes.find((node) => node.id === 'sector')
    expect(sector).toBeDefined()
    if (!sector) return

    const impacts = new Map<string, number>([
      ['asset-a', 120],
      ['asset-b', -60],
    ])

    const model = buildGraphTooltipModel({
      node: sector,
      horizon: 'oneMonth',
      impact: 0,
      chain,
      temporalAnalysis: temporal,
      impactByNodeId: impacts,
    })

    expect(model.topHoldings.length).toBe(2)
    expect(model.topHoldings[0]?.ticker).toBe('NVDA')
    expect(model.pathAttributions.length).toBeGreaterThan(0)
    expect(model.nodeImpactCad).toBe(60)
    expect(model.portfolioImpactCad).toBe(260)
    expect(model.confidenceDrivers.length).toBe(3)
  })

  it('flags zero-impact holdings as no measurable impact', () => {
    const chain = buildChain()
    const temporal = buildTemporalAnalysis()
    const asset = chain.nodes.find((node) => node.id === 'asset-b')
    expect(asset).toBeDefined()
    if (!asset) return

    const model = buildGraphTooltipModel({
      node: asset,
      horizon: 'oneWeek',
      impact: 0,
      chain,
      temporalAnalysis: temporal,
      impactByNodeId: new Map<string, number>([['asset-b', 0]]),
    })

    expect(model.noMeasurableImpact).toBe(true)
    expect(model.topHoldings.length).toBe(0)
  })
})
