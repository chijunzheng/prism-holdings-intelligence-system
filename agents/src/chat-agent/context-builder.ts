import type { CausalChainNode, CausalChain, ExposureMap, Signal, UserProfile } from '@prism/shared'
import type { ChatContext, TemporalAnalysis } from './types'

/**
 * Builds the complete chat context from node selection + pipeline data.
 * All context is structured and pre-loaded — no RAG retrieval needed.
 */
export function buildChatContext(
  node: CausalChainNode,
  chain: CausalChain,
  signal: Signal,
  exposureMap: ExposureMap,
  profile: UserProfile,
  temporalAnalysis: TemporalAnalysis,
): ChatContext {
  return {
    node,
    chain,
    signal,
    exposureMap,
    profile,
    temporalAnalysis,
  }
}

/**
 * Extracts the subgraph relevant to the selected node to keep
 * context focused and within LLM token limits.
 */
export function extractRelevantSubgraph(
  node: CausalChainNode,
  chain: CausalChain,
): { readonly nodes: ReadonlyArray<CausalChainNode>; readonly edgeSummary: string } {
  const connectedEdges = chain.edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  )

  const connectedNodeIds = new Set<string>([node.id])
  for (const edge of connectedEdges) {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  }

  // Also include second-hop nodes for richer context
  const secondHopEdges = chain.edges.filter(
    (e) =>
      (connectedNodeIds.has(e.source) || connectedNodeIds.has(e.target)) &&
      !(e.source === node.id || e.target === node.id),
  )

  for (const edge of secondHopEdges) {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  }

  const nodes = chain.nodes.filter((n) => connectedNodeIds.has(n.id))

  const edgeSummary = [...connectedEdges, ...secondHopEdges]
    .map((e) => {
      const src = chain.nodes.find((n) => n.id === e.source)
      const tgt = chain.nodes.find((n) => n.id === e.target)
      return `${src?.label ?? e.source} → ${tgt?.label ?? e.target}: ${e.mechanism}`
    })
    .join('\n')

  return { nodes, edgeSummary }
}
