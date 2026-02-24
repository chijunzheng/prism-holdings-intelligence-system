import { useCallback, useEffect, useState } from 'react'
import type { GraphDataResponse } from '../types/graph'

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

export function useCausalChain(userId: string, signalId: string | undefined): CausalChainState & {
  readonly refetch: () => Promise<void>
} {
  const [state, setState] = useState<CausalChainState>({
    data: null,
    loading: false,
    error: null,
  })

  const fetchChain = useCallback(async () => {
    if (!signalId) {
      setState({ data: null, loading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(`/api/graph/${userId}/${encodeURIComponent(signalId)}`)
      const payload = (await response.json()) as ApiEnvelope

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? `Failed to load graph data: ${response.status}`)
      }

      setState({ data: payload.data, loading: false, error: null })
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [signalId, userId])

  useEffect(() => {
    void fetchChain()
  }, [fetchChain])

  return { ...state, refetch: fetchChain }
}
