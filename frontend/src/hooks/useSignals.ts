import { useEffect, useState } from 'react'
import type { Signal } from '@prism/shared'

interface SignalsState {
  readonly signals: ReadonlyArray<Signal>
  readonly loading: boolean
  readonly error: string | null
  readonly lastUpdated: string | null
}

interface SignalsApiResponse {
  readonly success: boolean
  readonly data?: ReadonlyArray<Signal>
  readonly error?: unknown
}

const DEFAULT_POLL_INTERVAL_MS = 60_000

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error) as { error?: { message?: string } }
      const nestedMessage = parsed.error?.message
      if (nestedMessage) return nestedMessage
    } catch {
      // Keep original string
    }
    return error
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string') return maybeMessage
  }

  return 'Unknown error'
}

export function useSignals(
  userId: string,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
): SignalsState {
  const [state, setState] = useState<SignalsState>({
    signals: [],
    loading: true,
    error: null,
    lastUpdated: null,
  })

  useEffect(() => {
    let cancelled = false
    let timerId: number | undefined

    const scheduleNextPoll = () => {
      if (cancelled || pollIntervalMs <= 0) return
      timerId = window.setTimeout(() => {
        void fetchSignals(false)
      }, pollIntervalMs)
    }

    const fetchSignals = async (isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setState((prev) => ({ ...prev, loading: true, error: null }))
      }

      try {
        const response = await fetch(`/api/signals/${userId}`)
        const payload = (await response.json()) as SignalsApiResponse

        if (!response.ok || !payload.success) {
          throw new Error(
            normalizeErrorMessage(payload.error) ?? `Failed to fetch signals: ${response.status}`,
          )
        }

        if (!cancelled) {
          setState({
            signals: payload.data ?? [],
            loading: false,
            error: null,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: normalizeErrorMessage(error),
          }))
        }
      } finally {
        scheduleNextPoll()
      }
    }

    void fetchSignals(true)

    return () => {
      cancelled = true
      if (timerId) window.clearTimeout(timerId)
    }
  }, [pollIntervalMs, userId])

  return state
}
