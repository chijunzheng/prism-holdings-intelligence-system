import { describe, it, expect } from 'vitest'
import type { CausalChain } from '@prism/shared'
import type { TemporalAnalysis } from '../../../types/graph'
import {
  clusterLowImpactAssets,
  computeGraphPositions,
  computeNodeDepths,
  filterChainByDepth,
  getEdgeColor,
  getEdgeOpacity,
  getEdgeThickness,
  getHorizonAdjustedImpact,
} from '../graph-utils'

function buildBaseChain(): CausalChain {
  return {
    id: 'chain-1',
    signalId: 'sig-1',
    generatedAt: '2026-02-24T00:00:00.000Z',
    summary: 'Test chain',
    disclaimer: 'Test disclaimer',
    maxHops: 3,
    isSpeculative: true,
    nodes: [
      {
        id: 'event-1',
        type: 'event',
        label: 'Event',
        description: 'Market event',
        confidence: 0.9,
        metadata: {},
      },
      {
        id: 'mechanism-1',
        type: 'mechanism',
        label: 'Mechanism',
        description: 'Transmission',
        confidence: 0.8,
        metadata: {},
      },
      {
        id: 'sector-1',
        type: 'sector',
        label: 'Sector',
        description: 'Sector exposure',
        confidence: 0.75,
        temporalClassification: 'structural',
        metadata: {},
      },
      {
        id: 'asset-1',
        type: 'asset',
        label: 'Asset A',
        description: 'Holding A',
        confidence: 0.72,
        dollarImpact: 520,
        percentageImpact: 0.03,
        temporalClassification: 'structural',
        metadata: {},
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'event-1',
        target: 'mechanism-1',
        magnitude: 0.7,
        direction: 'negative',
        confidence: 0.9,
        mechanism: 'Event to mechanism',
      },
      {
        id: 'edge-2',
        source: 'mechanism-1',
        target: 'sector-1',
        magnitude: 0.6,
        direction: 'negative',
        confidence: 0.85,
        mechanism: 'Mechanism to sector',
      },
      {
        id: 'edge-3',
        source: 'sector-1',
        target: 'asset-1',
        magnitude: 0.5,
        direction: 'negative',
        confidence: 0.8,
        mechanism: 'Sector to asset',
      },
    ],
  }
}

function buildTemporalAnalysis(): TemporalAnalysis {
  return {
    classification: 'structural',
    confidence: 0.84,
    timeBuckets: {
      oneWeek: {
        direction: 'negative',
        expectedDollarImpact: -120,
        lowDollarImpact: -160,
        highDollarImpact: -80,
        confidence: 0.66,
      },
      oneMonth: {
        direction: 'negative',
        expectedDollarImpact: -240,
        lowDollarImpact: -300,
        highDollarImpact: -180,
        confidence: 0.72,
      },
      sixMonth: {
        direction: 'negative',
        expectedDollarImpact: -600,
        lowDollarImpact: -820,
        highDollarImpact: -420,
        confidence: 0.64,
      },
    },
    recommendations: [],
    counterfactual: {
      scenario: 'Shift 10% to defensive sectors',
      estimatedOutcomeDifferenceCad: 750,
      explanation: 'Lower downside exposure',
    },
  }
}

describe('graph-utils', () => {
  it('encodes edge color, opacity, and thickness bounds', () => {
    expect(getEdgeColor('positive')).toBe('#22c55e')
    expect(getEdgeColor('negative')).toBe('#ef4444')
    expect(getEdgeColor('ambiguous')).toBe('#eab308')

    expect(getEdgeOpacity(0.1)).toBe(0.3)
    expect(getEdgeOpacity(0.7)).toBe(0.7)
    expect(getEdgeOpacity(3)).toBe(1)

    expect(getEdgeThickness(0)).toBe(1)
    expect(getEdgeThickness(1)).toBe(8)
    expect(getEdgeThickness(0.5)).toBeGreaterThan(1)
  })

  it('computes depths and filters graph by hop depth', () => {
    const chain = buildBaseChain()
    const depths = computeNodeDepths(chain)

    expect(depths.get('event-1')).toBe(0)
    expect(depths.get('mechanism-1')).toBe(1)
    expect(depths.get('sector-1')).toBe(2)
    expect(depths.get('asset-1')).toBe(3)

    const filtered = filterChainByDepth(chain, 2)
    expect(filtered.nodes.map((node) => node.id)).toEqual(['event-1', 'mechanism-1', 'sector-1'])
    expect(filtered.edges.map((edge) => edge.id)).toEqual(['edge-1', 'edge-2'])
  })

  it('clusters lower-impact assets when node count exceeds threshold', () => {
    const base = buildBaseChain()
    const extraAssets = Array.from({ length: 20 }, (_value, index) => {
      const assetId = `asset-extra-${index + 1}`
      return {
        node: {
          id: assetId,
          type: 'asset' as const,
          label: `Asset ${index + 2}`,
          description: 'Extra holding',
          confidence: 0.55,
          dollarImpact: 100 - index,
          percentageImpact: 0.005,
          temporalClassification: 'ambiguous' as const,
          metadata: {},
        },
        edge: {
          id: `edge-extra-${index + 1}`,
          source: 'sector-1',
          target: assetId,
          magnitude: 0.2,
          direction: 'ambiguous' as const,
          confidence: 0.5,
          mechanism: 'Sector spillover',
        },
      }
    })

    const chain: CausalChain = {
      ...base,
      nodes: [
        ...base.nodes.filter((node) => node.id !== 'asset-1'),
        ...extraAssets.map((item) => item.node),
      ],
      edges: [
        ...base.edges.filter((edge) => edge.id !== 'edge-3'),
        ...extraAssets.map((item) => item.edge),
      ],
    }

    const clustered = clusterLowImpactAssets(chain, 18)
    expect(clustered.nodes.find((node) => node.id === 'cluster-assets')).toBeDefined()
    expect(clustered.nodes.filter((node) => node.type === 'asset').length).toBe(6)
    expect(clustered.edges.some((edge) => edge.target === 'cluster-assets')).toBe(true)
  })

  it('adjusts node impact by horizon and counterfactual', () => {
    const chain = buildBaseChain()
    const asset = chain.nodes.find((node) => node.id === 'asset-1')
    expect(asset).toBeDefined()
    if (!asset) return

    const analysis = buildTemporalAnalysis()

    const oneMonth = getHorizonAdjustedImpact(asset, analysis, 'oneMonth', false)
    const sixMonth = getHorizonAdjustedImpact(asset, analysis, 'sixMonth', false)
    const sixMonthCounterfactual = getHorizonAdjustedImpact(asset, analysis, 'sixMonth', true)

    expect(oneMonth).toBeCloseTo(-520, 1)
    expect(sixMonth).toBeLessThan(oneMonth)
    expect(sixMonthCounterfactual).toBeGreaterThan(sixMonth)
  })

  it('places nodes in deterministic left-to-right ranks', () => {
    const chain = buildBaseChain()
    const positions = computeGraphPositions(chain, 1200, 700)

    const event = positions.get('event-1')
    const mechanism = positions.get('mechanism-1')
    const sector = positions.get('sector-1')
    const asset = positions.get('asset-1')

    expect(event).toBeDefined()
    expect(mechanism).toBeDefined()
    expect(sector).toBeDefined()
    expect(asset).toBeDefined()

    if (!event || !mechanism || !sector || !asset) return

    expect(event.x).toBeLessThan(mechanism.x)
    expect(mechanism.x).toBeLessThan(sector.x)
    expect(sector.x).toBeLessThan(asset.x)
  })
})
