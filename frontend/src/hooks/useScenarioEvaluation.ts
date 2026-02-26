import { useCallback, useRef, useState } from 'react'
import type { StrategyEvaluateRequest, StrategyEvaluation } from '../types/graph'

interface StrategyEvaluationState {
  readonly evaluation: StrategyEvaluation | null
  readonly loading: boolean
  readonly error: string | null
}

interface ApiEnvelope<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

export function useScenarioEvaluation(userId: string): StrategyEvaluationState & {
  readonly evaluate: (request: StrategyEvaluateRequest) => Promise<StrategyEvaluation | null>
  readonly clear: () => void
} {
  const [state, setState] = useState<StrategyEvaluationState>({
    evaluation: null,
    loading: false,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const evaluate = useCallback(
    async (request: StrategyEvaluateRequest): Promise<StrategyEvaluation | null> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const response = await fetch(`/api/strategy/${userId}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        const payload = (await response.json()) as ApiEnvelope<StrategyEvaluation>

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? `Scenario evaluation failed (${response.status})`)
        }

        setState({ evaluation: payload.data, loading: false, error: null })
        return payload.data
      } catch (error) {
        if (controller.signal.aborted) return null
        const message = error instanceof Error ? error.message : 'Unknown strategy evaluation error'
        setState((prev) => ({ ...prev, loading: false, error: message }))
        return null
      }
    },
    [userId],
  )

  const clear = useCallback(() => {
    setState({ evaluation: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    evaluate,
    clear,
  }
}
