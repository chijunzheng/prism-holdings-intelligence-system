import { useCallback, useRef, useState } from 'react'
import type { StrategyDraft, StrategyDraftRequest } from '../types/graph'

interface StrategyDraftState {
  readonly draft: StrategyDraft | null
  readonly loading: boolean
  readonly error: string | null
}

interface ApiEnvelope<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

export function useStrategyDraft(userId: string): StrategyDraftState & {
  readonly createDraft: (request: StrategyDraftRequest) => Promise<StrategyDraft | null>
  readonly clear: () => void
} {
  const [state, setState] = useState<StrategyDraftState>({
    draft: null,
    loading: false,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const createDraft = useCallback(
    async (request: StrategyDraftRequest): Promise<StrategyDraft | null> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const response = await fetch(`/api/strategy/${userId}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        const payload = (await response.json()) as ApiEnvelope<StrategyDraft>

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? `Draft request failed (${response.status})`)
        }

        setState({ draft: payload.data, loading: false, error: null })
        return payload.data
      } catch (error) {
        if (controller.signal.aborted) return null
        const message = error instanceof Error ? error.message : 'Unknown strategy draft error'
        setState((prev) => ({ ...prev, loading: false, error: message }))
        return null
      }
    },
    [userId],
  )

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setState({ draft: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    createDraft,
    clear,
  }
}
