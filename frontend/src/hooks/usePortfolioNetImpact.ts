import { useCallback, useEffect, useRef, useState } from 'react'
import type { PortfolioNetImpactResponse } from '../types/graph'
import { traceImpact } from '../utils/trace'

interface PortfolioNetImpactState {
  readonly data: PortfolioNetImpactResponse | null
  readonly loading: boolean
  readonly error: string | null
}

interface ApiEnvelope {
  readonly success: boolean
  readonly data?: PortfolioNetImpactResponse
  readonly error?: string
}

const NET_CACHE_TTL_MS = 3 * 60 * 1000
const netImpactCache = new Map<string, { readonly data: PortfolioNetImpactResponse; readonly cachedAt: number }>()

export function usePortfolioNetImpact(
  userId: string,
  enabled = true,
): PortfolioNetImpactState & { readonly refetch: () => Promise<void> } {
  const [state, setState] = useState<PortfolioNetImpactState>({
    data: null,
    loading: false,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetchNetImpact = useCallback(async () => {
    if (!enabled) {
      abortRef.current?.abort()
      abortRef.current = null
      setState({ data: null, loading: false, error: null })
      traceImpact('impact-net:skipped', { userId, reason: 'disabled' })
      return
    }

    const cached = netImpactCache.get(userId)
    if (cached && Date.now() - cached.cachedAt < NET_CACHE_TTL_MS) {
      setState({ data: cached.data, loading: false, error: null })
      traceImpact('impact-net:cache-hit', {
        userId,
        ageMs: Date.now() - cached.cachedAt,
      })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = performance.now()

    setState((prev) => ({ ...prev, loading: true, error: null }))
    traceImpact('impact-net:fetch:start', { userId })

    try {
      const response = await fetch(`/api/impact/${userId}/net`, {
        signal: controller.signal,
      })
      const payload = (await response.json()) as ApiEnvelope

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? `Failed to load portfolio net impact: ${response.status}`)
      }

      netImpactCache.set(userId, { data: payload.data, cachedAt: Date.now() })
      setState({ data: payload.data, loading: false, error: null })
      traceImpact('impact-net:fetch:success', {
        userId,
        durationMs: Math.round(performance.now() - startedAt),
        includedSignalCount: payload.data.includedSignalCount,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        traceImpact('impact-net:fetch:aborted', { userId })
        return
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      setState({ data: null, loading: false, error: message })
      traceImpact('impact-net:fetch:error', {
        userId,
        error: message,
        durationMs: Math.round(performance.now() - startedAt),
      })
    }
  }, [enabled, userId])

  useEffect(() => {
    void fetchNetImpact()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [fetchNetImpact])

  return { ...state, refetch: fetchNetImpact }
}
