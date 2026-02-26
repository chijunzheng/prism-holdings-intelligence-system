import { useEffect, useState } from 'react'
import type { Signal } from '@prism/shared'
import { traceImpact } from '../utils/trace'

interface SignalsState {
  readonly signals: ReadonlyArray<Signal>
  readonly loading: boolean
  readonly error: string | null
  readonly lastUpdated: string | null
  readonly mode: string | null
  readonly requestId: string | null
}

interface SignalsApiDebug {
  readonly totalSignals?: number
  readonly urgencyBreakdown?: Partial<Record<Signal['urgency'], number>>
}

interface SignalsApiResponse {
  readonly success: boolean
  readonly data?: ReadonlyArray<Signal>
  readonly error?: unknown
  readonly mode?: string
  readonly requestId?: string
  readonly durationMs?: number
  readonly debug?: SignalsApiDebug
}

const DEFAULT_POLL_INTERVAL_MS = 60_000
const MEMORY_CACHE_TTL_MS = 30_000
const EMPTY_CACHE_TTL_MS = 5_000
const SIGNAL_EMPTY_RETRY_DELAY_MS = 250

function isLocalDebugSession(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
}

const DEV_SIGNAL_DEBUG = isLocalDebugSession()
const signalsMemoryCache = new Map<
  string,
  {
    readonly signals: ReadonlyArray<Signal>
    readonly lastUpdated: string
    readonly cachedAt: number
    readonly mode: string | null
    readonly requestId: string | null
  }
>()

interface UseSignalsOptions {
  readonly enabled?: boolean
}

function getCacheTtlMs(signalCount: number): number {
  return signalCount > 0 ? MEMORY_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS
}

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

function signalUrgencyBreakdown(signals: ReadonlyArray<Signal>): Record<Signal['urgency'], number> {
  const counts: Record<Signal['urgency'], number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }
  for (const signal of signals) {
    counts[signal.urgency] += 1
  }
  return counts
}

function debugSignals(scope: string, payload: unknown, level: 'log' | 'warn' = 'log'): void {
  if (!DEV_SIGNAL_DEBUG) return
  // eslint-disable-next-line no-console
  console[level](`[PrismSignals][${scope}]`, payload)
}

export function useSignals(
  userId: string,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  options?: UseSignalsOptions,
): SignalsState {
  const enabled = options?.enabled ?? true
  const [state, setState] = useState<SignalsState>({
    signals: [],
    loading: enabled,
    error: null,
    lastUpdated: null,
    mode: null,
    requestId: null,
  })

  useEffect(() => {
    if (!enabled) {
      traceImpact('signals:disabled', { userId })
      setState((prev) => ({ ...prev, loading: false }))
      return
    }

    let cancelled = false
    let timerId: number | undefined

    const cached = signalsMemoryCache.get(userId)
    if (cached && Date.now() - cached.cachedAt < getCacheTtlMs(cached.signals.length)) {
      traceImpact('signals:cache-hit', {
        userId,
        signalCount: cached.signals.length,
        ageMs: Date.now() - cached.cachedAt,
      })
      setState({
        signals: cached.signals,
        loading: false,
        error: null,
        lastUpdated: cached.lastUpdated,
        mode: cached.mode,
        requestId: cached.requestId,
      })
      debugSignals('cache-hit', {
        userId,
        signalCount: cached.signals.length,
        mode: cached.mode,
        requestId: cached.requestId,
      })
    }

    const scheduleNextPoll = () => {
      if (cancelled || pollIntervalMs <= 0) return
      timerId = window.setTimeout(() => {
        void fetchSignals(false)
      }, pollIntervalMs)
    }

    const fetchSignals = async (
      isInitialLoad: boolean,
      forceRefresh = false,
      allowEmptyRetry = true,
    ) => {
      const startedAt = performance.now()
      const endpoint = forceRefresh
        ? `/api/signals/${userId}?refresh=1`
        : `/api/signals/${userId}`
      traceImpact('signals:fetch:start', { userId, isInitialLoad, forceRefresh })
      debugSignals('fetch:start', { userId, isInitialLoad, forceRefresh, endpoint })

      if (isInitialLoad) {
        setState((prev) => ({ ...prev, loading: true, error: null }))
      }

      try {
        let shouldScheduleNextPoll = true
        const response = await fetch(endpoint)
        const payload = (await response.json()) as SignalsApiResponse
        const requestId = payload.requestId ?? response.headers.get('x-prism-trace-id') ?? null
        const mode = payload.mode ?? null

        if (!response.ok || !payload.success) {
          throw new Error(
            normalizeErrorMessage(payload.error) ?? `Failed to fetch signals: ${response.status}`,
          )
        }

        const signals = payload.data ?? []
        if (signals.length === 0 && allowEmptyRetry && !forceRefresh) {
          shouldScheduleNextPoll = false
          debugSignals('fetch:empty-retry', {
            userId,
            mode,
            requestId,
            serverDurationMs: payload.durationMs ?? null,
          }, 'warn')
          await new Promise((resolve) => window.setTimeout(resolve, SIGNAL_EMPTY_RETRY_DELAY_MS))
          await fetchSignals(false, true, false)
          return
        }

        if (!cancelled) {
          const lastUpdated = new Date().toISOString()
          signalsMemoryCache.set(userId, {
            signals,
            lastUpdated,
            cachedAt: Date.now(),
            mode,
            requestId,
          })
          setState({
            signals,
            loading: false,
            error: null,
            lastUpdated,
            mode,
            requestId,
          })
          const urgencyBreakdown = payload.debug?.urgencyBreakdown ?? signalUrgencyBreakdown(signals)
          debugSignals('fetch:success', {
            userId,
            signalCount: signals.length,
            mode,
            requestId,
            urgencyBreakdown,
            serverDurationMs: payload.durationMs ?? null,
            durationMs: Math.round(performance.now() - startedAt),
          })
          traceImpact('signals:fetch:success', {
            userId,
            signalCount: signals.length,
            mode: mode ?? 'unknown',
            requestId: requestId ?? undefined,
            serverDurationMs: payload.durationMs ?? null,
            durationMs: Math.round(performance.now() - startedAt),
          })
          if (signals.length === 0) {
            debugSignals('fetch:empty', {
              userId,
              mode,
              requestId,
              urgencyBreakdown,
            }, 'warn')
            traceImpact('signals:fetch:empty', {
              userId,
              mode: mode ?? 'unknown',
              requestId: requestId ?? undefined,
            })
          }
        }

        if (shouldScheduleNextPoll) {
          scheduleNextPoll()
        }
      } catch (error) {
        if (!cancelled) {
          const normalizedError = normalizeErrorMessage(error)
          setState((prev) => ({
            ...prev,
            loading: false,
            error: normalizedError,
          }))
          debugSignals('fetch:error', {
            userId,
            error: normalizedError,
            durationMs: Math.round(performance.now() - startedAt),
          }, 'warn')
          traceImpact('signals:fetch:error', {
            userId,
            error: normalizedError,
            durationMs: Math.round(performance.now() - startedAt),
          })
        }
        scheduleNextPoll()
      }
    }

    void fetchSignals(true)

    return () => {
      cancelled = true
      if (timerId) window.clearTimeout(timerId)
    }
  }, [enabled, pollIntervalMs, userId])

  return state
}
