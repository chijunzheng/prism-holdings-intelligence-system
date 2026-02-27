import { useCallback, useState } from 'react'
import type { GraphDataResponse } from '../types/graph'

interface GraphExpansionState {
  readonly loading: boolean
  readonly error: string | null
}

interface Envelope {
  readonly success: boolean
  readonly data?: GraphDataResponse
  readonly error?: string
}

function mergeGraphData(base: GraphDataResponse, incoming: GraphDataResponse): GraphDataResponse {
  const nodeMap = new Map(base.chain.nodes.map((node) => [node.id, node]))
  for (const node of incoming.chain.nodes) nodeMap.set(node.id, node)

  const edgeMap = new Map(base.chain.edges.map((edge) => [edge.id, edge]))
  for (const edge of incoming.chain.edges) edgeMap.set(edge.id, edge)

  return {
    ...base,
    chain: {
      ...base.chain,
      id: incoming.chain.id,
      nodes: [...nodeMap.values()],
      edges: [...edgeMap.values()],
      summary: incoming.chain.summary,
    },
  }
}

export function useGraphExpansion(userId: string): GraphExpansionState & {
  readonly expandNode: (
    current: GraphDataResponse,
    signalId: string,
    nodeId: string,
    depth?: number,
  ) => Promise<GraphDataResponse | null>
} {
  const [state, setState] = useState<GraphExpansionState>({ loading: false, error: null })

  const expandNode = useCallback(
    async (
      current: GraphDataResponse,
      signalId: string,
      nodeId: string,
      depth = 1,
    ): Promise<GraphDataResponse | null> => {
      setState({ loading: true, error: null })
      try {
        const response = await fetch(`/api/graph/${userId}/${encodeURIComponent(signalId)}/expand`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, depth }),
        })
        const payload = (await response.json()) as Envelope
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? `Failed to expand graph node (${response.status})`)
        }

        const merged = mergeGraphData(current, payload.data)
        setState({ loading: false, error: null })
        return merged
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown graph expansion error'
        setState({ loading: false, error: message })
        return null
      }
    },
    [userId],
  )

  return { ...state, expandNode }
}
