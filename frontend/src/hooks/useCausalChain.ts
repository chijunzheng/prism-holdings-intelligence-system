import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphDataResponse } from '../types/graph'
import { traceImpact } from '../utils/trace'

interface CausalChainState {
  readonly data: GraphDataResponse | null
  readonly loading: boolean
  readonly error: string | null
}

interface ApiEnvelope {
  readonly success: boolean
  readonly data?: GraphDataResponse
  readonly error?: string
}

const GRAPH_CACHE_TTL_MS = 5 * 60 * 1000
const graphCache = new Map<string, { readonly data: GraphDataResponse; readonly cachedAt: number }>()

function cacheKey(userId: string, signalId: string): string {
  return `${userId}::${signalId}`
}

export function useCausalChain(userId: string, signalId: string | undefined): CausalChainState & {
  readonly refetch: () => Promise<void>
} {
  const [state, setState] = useState<CausalChainState>({
    data: null,
    loading: false,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetchChain = useCallback(async () => {
    if (!signalId) {
      abortRef.current?.abort()
      abortRef.current = null
      setState({ data: null, loading: false, error: null })
      traceImpact('graph:skipped', { userId, reason: 'missing-signal-id' })
      return
    }

    const key = cacheKey(userId, signalId)
    const cached = graphCache.get(key)
    if (cached && Date.now() - cached.cachedAt < GRAPH_CACHE_TTL_MS) {
      setState({ data: cached.data, loading: false, error: null })
      traceImpact('graph:cache-hit', {
        userId,
        signalId,
        ageMs: Date.now() - cached.cachedAt,
      })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = performance.now()

    setState((prev) => ({ ...prev, loading: true, error: null }))
    traceImpact('graph:fetch:start', { userId, signalId })

    try {
      const response = await fetch(`/api/graph/${userId}/${encodeURIComponent(signalId)}`, {
        signal: controller.signal,
      })
      const payload = (await response.json()) as ApiEnvelope

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? `Failed to load graph data: ${response.status}`)
      }

      graphCache.set(key, { data: payload.data, cachedAt: Date.now() })
      setState({ data: payload.data, loading: false, error: null })
      traceImpact('graph:fetch:success', {
        userId,
        signalId,
        durationMs: Math.round(performance.now() - startedAt),
        nodeCount: payload.data.chain.nodes.length,
        edgeCount: payload.data.chain.edges.length,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        traceImpact('graph:fetch:aborted', { userId, signalId })
        return
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      setState({
        data: null,
        loading: false,
        error: message,
      })
      traceImpact('graph:fetch:error', {
        userId,
        signalId,
        error: message,
        durationMs: Math.round(performance.now() - startedAt),
      })
    }
  }, [signalId, userId])

  useEffect(() => {
    void fetchChain()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [fetchChain])

  return { ...state, refetch: fetchChain }
}
