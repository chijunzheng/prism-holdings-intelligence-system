import type { CausalChain, CausalChainEdge, CausalChainNode } from '@prism/shared'
import type { GraphNodePosition, GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'

const MIN_EDGE_OPACITY = 0.35
const MAX_EDGE_THICKNESS = 3.5
const MIN_EDGE_THICKNESS = 0.75
const CLUSTER_NODE_ID = 'cluster-assets'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toDirection(net: number): CausalChainEdge['direction'] {
  if (net > 0.01) return 'positive'
  if (net < -0.01) return 'negative'
  return 'ambiguous'
}

function asAssetNode(node: CausalChainNode): CausalChainNode & { type: 'asset' } {
  return node as CausalChainNode & { type: 'asset' }
}

export function getEdgeColor(direction: CausalChainEdge['direction']): string {
  if (direction === 'positive') return '#6ec98a'
  if (direction === 'negative') return '#e08080'
  return '#d4b45c'
}

export function getEdgeOpacity(confidence: number): number {
  return clamp(confidence, MIN_EDGE_OPACITY, 0.85)
}

export function getEdgeThickness(magnitude: number): number {
  return clamp(MIN_EDGE_THICKNESS + magnitude * (MAX_EDGE_THICKNESS - MIN_EDGE_THICKNESS), MIN_EDGE_THICKNESS, MAX_EDGE_THICKNESS)
}

export function computeNodeDepths(chain: CausalChain): ReadonlyMap<string, number> {
  const adjacency = new Map<string, string[]>()
  for (const edge of chain.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const depths = new Map<string, number>()
  const queue: Array<{ nodeId: string; depth: number }> = []

  for (const node of chain.nodes) {
    if (node.type === 'event') {
      depths.set(node.id, 0)
      queue.push({ nodeId: node.id, depth: 0 })
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break

    const nextDepth = current.depth + 1
    const neighbors = adjacency.get(current.nodeId) ?? []
    for (const neighbor of neighbors) {
      const existing = depths.get(neighbor)
      if (existing === undefined || nextDepth < existing) {
        depths.set(neighbor, nextDepth)
        queue.push({ nodeId: neighbor, depth: nextDepth })
      }
    }
  }

  return depths
}

export function filterChainByDepth(chain: CausalChain, maxDepth: number): CausalChain {
  const depths = computeNodeDepths(chain)
  const allowedNodes = chain.nodes.filter((node) => (depths.get(node.id) ?? 0) <= maxDepth)
  const allowedIds = new Set(allowedNodes.map((node) => node.id))

  return {
    ...chain,
    nodes: allowedNodes,
    edges: chain.edges.filter(
      (edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target),
    ),
  }
}

export function clusterLowImpactAssets(chain: CausalChain, maxNodes = 18): CausalChain {
  if (chain.nodes.length <= maxNodes) return chain

  const assetNodes = chain.nodes.filter((node) => node.type === 'asset').map(asAssetNode)
  if (assetNodes.length <= 6) return chain

  const sortedAssets = [...assetNodes].sort(
    (a, b) => Math.abs((b.dollarImpact ?? 0)) - Math.abs((a.dollarImpact ?? 0)),
  )
  const keepAssets = new Set(sortedAssets.slice(0, 5).map((node) => node.id))
  const collapsedAssets = sortedAssets.slice(5)
  if (collapsedAssets.length === 0) return chain

  const collapsedIds = new Set(collapsedAssets.map((node) => node.id))
  const clusterImpact = collapsedAssets.reduce((sum, node) => sum + (node.dollarImpact ?? 0), 0)

  const remainingNodes = chain.nodes.filter(
    (node) => node.type !== 'asset' || keepAssets.has(node.id),
  )
  const clusterNode: CausalChainNode = {
    id: CLUSTER_NODE_ID,
    type: 'asset',
    label: `Other Holdings (${collapsedAssets.length})`,
    description: 'Clustered lower-impact assets for readability',
    confidence:
      collapsedAssets.reduce((sum, node) => sum + node.confidence, 0) / collapsedAssets.length,
    dollarImpact: clusterImpact,
    percentageImpact: undefined,
    temporalClassification: undefined,
    metadata: {
      clustered: true,
      sourceNodeIds: Array.from(collapsedIds),
    },
  }

  const passthroughEdges = chain.edges.filter(
    (edge) => !collapsedIds.has(edge.source) && !collapsedIds.has(edge.target),
  )

  const incomingBySource = new Map<string, CausalChainEdge[]>()
  for (const edge of chain.edges) {
    if (!collapsedIds.has(edge.target)) continue
    const bucket = incomingBySource.get(edge.source) ?? []
    bucket.push(edge)
    incomingBySource.set(edge.source, bucket)
  }

  const clusterEdges: CausalChainEdge[] = Array.from(incomingBySource.entries()).map(
    ([source, edges], index) => {
      const magnitude = edges.reduce((sum, edge) => sum + edge.magnitude, 0) / edges.length
      const confidence = edges.reduce((sum, edge) => sum + edge.confidence, 0) / edges.length
      const directionNet = edges.reduce((sum, edge) => {
        if (edge.direction === 'positive') return sum + 1
        if (edge.direction === 'negative') return sum - 1
        return sum
      }, 0)

      return {
        id: `cluster-edge-${index + 1}`,
        source,
        target: CLUSTER_NODE_ID,
        magnitude,
        direction: toDirection(directionNet),
        confidence,
        mechanism: 'Aggregated lower-impact holdings path',
      }
    },
  )

  return {
    ...chain,
    nodes: [...remainingNodes, clusterNode],
    edges: [...passthroughEdges, ...clusterEdges],
  }
}

export function getHorizonAdjustedImpact(
  node: CausalChainNode,
  temporalAnalysis: TemporalAnalysis | null,
  horizon: GraphTimeHorizon,
  counterfactualEnabled: boolean,
): number {
  const baseImpact = node.dollarImpact ?? 0
  if (!temporalAnalysis || node.type !== 'asset') {
    return baseImpact
  }

  const oneMonth = temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact
  const bucket = temporalAnalysis.timeBuckets[horizon]
  const magnitudeScale = Math.abs(bucket.expectedDollarImpact) / Math.max(Math.abs(oneMonth), 1)
  const sign = Math.sign(baseImpact) || 1
  let adjusted = Math.abs(baseImpact) * magnitudeScale * sign

  if (counterfactualEnabled) {
    const difference = temporalAnalysis.counterfactual?.estimatedOutcomeDifferenceCad ?? 0
    const softeningFactor = clamp(1 - difference / 5000, 0.55, 1)
    adjusted *= softeningFactor
  }

  return adjusted
}

function rankForNodeType(node: CausalChainNode): number {
  if (node.type === 'event') return 0
  if (node.type === 'mechanism') return 1
  if (node.type === 'sector') return 2
  return 3
}

export function computeGraphPositions(
  chain: CausalChain,
  width: number,
  height: number,
): ReadonlyMap<string, GraphNodePosition> {
  const grouped = new Map<number, CausalChainNode[]>()
  for (const node of chain.nodes) {
    const rank = rankForNodeType(node)
    const bucket = grouped.get(rank) ?? []
    bucket.push(node)
    grouped.set(rank, bucket)
  }

  const orderedRanks = [0, 1, 2, 3]
  const leftPad = 130
  const rightPad = 130
  const topPad = 56
  const bottomPad = 56
  const usableWidth = Math.max(320, width - leftPad - rightPad)
  const usableHeight = Math.max(220, height - topPad - bottomPad)
  const xStep = usableWidth / (orderedRanks.length - 1)

  const positions = new Map<string, GraphNodePosition>()
  for (const rank of orderedRanks) {
    const nodes = [...(grouped.get(rank) ?? [])].sort((a, b) => a.label.localeCompare(b.label))
    if (nodes.length === 0) continue

    const yStep = usableHeight / (nodes.length + 1)
    nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: leftPad + rank * xStep,
        y: topPad + (index + 1) * yStep,
      })
    })
  }

  return positions
}
