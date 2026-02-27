import type { CausalChain, CausalChainEdge, CausalChainNode } from '@prism/shared'

export interface PruningOptions {
  readonly maxNodes: number
  readonly maxEdges: number
  readonly topPathsPerHolding: number
  readonly mechanismGroupThreshold: number
  readonly mainPathOnly: boolean
}

export const EMBEDDED_DEFAULTS: PruningOptions = {
  maxNodes: 15,
  maxEdges: 30,
  topPathsPerHolding: 2,
  mechanismGroupThreshold: 3,
  mainPathOnly: true,
}

export const CANVAS_DEFAULTS: PruningOptions = {
  maxNodes: 40,
  maxEdges: 80,
  topPathsPerHolding: 5,
  mechanismGroupThreshold: 5,
  mainPathOnly: false,
}

interface Path {
  readonly nodes: ReadonlyArray<string>
  readonly edges: ReadonlyArray<string>
  readonly score: number
}

function buildAdjacencyMap(edges: ReadonlyArray<CausalChainEdge>): Map<string, CausalChainEdge[]> {
  const adjacency = new Map<string, CausalChainEdge[]>()
  for (const edge of edges) {
    const existing = adjacency.get(edge.target) ?? []
    adjacency.set(edge.target, [...existing, edge])
  }
  return adjacency
}

function findPathsToEvent(
  nodeId: string,
  adjacency: Map<string, CausalChainEdge[]>,
  nodeMap: Map<string, CausalChainNode>,
  visited = new Set<string>(),
): ReadonlyArray<Path> {
  const node = nodeMap.get(nodeId)
  if (!node) return []
  if (node.type === 'event') {
    return [{ nodes: [nodeId], edges: [], score: 1.0 }]
  }

  if (visited.has(nodeId)) return []
  const newVisited = new Set([...visited, nodeId])

  const incomingEdges = adjacency.get(nodeId) ?? []
  const allPaths: Path[] = []

  for (const edge of incomingEdges) {
    const subPaths = findPathsToEvent(edge.source, adjacency, nodeMap, newVisited)
    for (const subPath of subPaths) {
      const pathScore = (subPath.score + edge.confidence * edge.magnitude) / 2
      allPaths.push({
        nodes: [...subPath.nodes, nodeId],
        edges: [...subPath.edges, edge.id],
        score: pathScore,
      })
    }
  }

  return allPaths
}

export function pruneToTopPaths(chain: CausalChain, topK: number): CausalChain {
  const nodeMap = new Map(chain.nodes.map((node) => [node.id, node]))
  const adjacency = buildAdjacencyMap(chain.edges)
  const assetNodes = chain.nodes.filter((node) => node.type === 'asset')

  const keptNodeIds = new Set<string>()
  const keptEdgeIds = new Set<string>()

  for (const assetNode of assetNodes) {
    const paths = findPathsToEvent(assetNode.id, adjacency, nodeMap)
    const sortedPaths = [...paths].sort((a, b) => b.score - a.score)
    const topPaths = sortedPaths.slice(0, topK)

    for (const path of topPaths) {
      for (const nodeId of path.nodes) keptNodeIds.add(nodeId)
      for (const edgeId of path.edges) keptEdgeIds.add(edgeId)
    }
  }

  return {
    ...chain,
    nodes: chain.nodes.filter((node) => keptNodeIds.has(node.id)),
    edges: chain.edges.filter((edge) => keptEdgeIds.has(edge.id)),
  }
}

export function enforceNodeBudget(chain: CausalChain, maxNodes: number): CausalChain {
  if (chain.nodes.length <= maxNodes) return chain

  const nonCriticalNodes = chain.nodes.filter(
    (node) => node.type !== 'event' && node.type !== 'asset',
  )
  const sortedNonCritical = [...nonCriticalNodes].sort((a, b) => a.confidence - b.confidence)
  const removeCount = chain.nodes.length - maxNodes
  const toRemove = new Set(sortedNonCritical.slice(0, removeCount).map((node) => node.id))

  const keptNodes = chain.nodes.filter((node) => !toRemove.has(node.id))
  const keptNodeIds = new Set(keptNodes.map((node) => node.id))
  const keptEdges = chain.edges.filter(
    (edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target),
  )

  return {
    ...chain,
    nodes: keptNodes,
    edges: keptEdges,
  }
}

export function enforceEdgeBudget(chain: CausalChain, maxEdges: number): CausalChain {
  if (chain.edges.length <= maxEdges) return chain

  const sortedEdges = [...chain.edges].sort((a, b) => a.confidence - b.confidence)
  const toRemove = new Set(sortedEdges.slice(0, chain.edges.length - maxEdges).map((edge) => edge.id))
  const keptEdges = chain.edges.filter((edge) => !toRemove.has(edge.id))

  const nodeIdsInEdges = new Set<string>()
  for (const edge of keptEdges) {
    nodeIdsInEdges.add(edge.source)
    nodeIdsInEdges.add(edge.target)
  }

  const keptNodes = chain.nodes.filter(
    (node) => node.type === 'event' || nodeIdsInEdges.has(node.id),
  )

  return {
    ...chain,
    nodes: keptNodes,
    edges: keptEdges,
  }
}

export function autoGroupMechanisms(chain: CausalChain, threshold: number): CausalChain {
  const nodeMap = new Map(chain.nodes.map((node) => [node.id, node]))
  const adjacency = buildAdjacencyMap(chain.edges)
  const assetNodes = chain.nodes.filter((node) => node.type === 'asset')

  const pathsToGroup = new Map<string, ReadonlyArray<string>>()

  for (const assetNode of assetNodes) {
    const paths = findPathsToEvent(assetNode.id, adjacency, nodeMap)
    for (const path of paths) {
      const mechanismNodes = path.nodes.filter((nodeId) => {
        const node = nodeMap.get(nodeId)
        return node?.type === 'mechanism'
      })
      if (mechanismNodes.length > threshold) {
        pathsToGroup.set(`path-${assetNode.id}-${path.nodes[0]}`, mechanismNodes)
      }
    }
  }

  if (pathsToGroup.size === 0) return chain

  const groupedNodeIds = new Set<string>()
  const newNodes: CausalChainNode[] = []
  const newEdges: CausalChainEdge[] = []
  let groupIndex = 0

  for (const [, mechanismNodeIds] of pathsToGroup.entries()) {
    groupIndex++
    const groupId = `group-${groupIndex}`
    for (const id of mechanismNodeIds) groupedNodeIds.add(id)

    const mechanismNodes = mechanismNodeIds.map((id) => nodeMap.get(id)!).filter(Boolean)
    const avgConfidence =
      mechanismNodes.reduce((sum, node) => sum + node.confidence, 0) / mechanismNodes.length

    newNodes.push({
      id: groupId,
      type: 'mechanism',
      label: `${mechanismNodes.length} mechanisms`,
      description: 'Grouped for readability',
      confidence: avgConfidence,
      metadata: { grouped: true, sourceNodeIds: Array.from(mechanismNodeIds) },
    })
  }

  const remainingNodes = chain.nodes.filter((node) => !groupedNodeIds.has(node.id))
  const remainingEdges = chain.edges.filter(
    (edge) => !groupedNodeIds.has(edge.source) && !groupedNodeIds.has(edge.target),
  )

  return {
    ...chain,
    nodes: [...remainingNodes, ...newNodes],
    edges: [...remainingEdges, ...newEdges],
  }
}

export function applyPruningPipeline(chain: CausalChain, options: PruningOptions): CausalChain {
  let processed = chain

  if (options.mainPathOnly) {
    processed = pruneToTopPaths(processed, options.topPathsPerHolding)
  }

  processed = enforceNodeBudget(processed, options.maxNodes)
  processed = enforceEdgeBudget(processed, options.maxEdges)
  processed = autoGroupMechanisms(processed, options.mechanismGroupThreshold)

  return processed
}
