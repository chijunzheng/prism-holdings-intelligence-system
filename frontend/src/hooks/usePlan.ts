import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlanSession, StrategyCandidate, StrategyDraft, StrategyEvaluation, StrategyScenarioItem } from '@prism/shared'

export interface PlanSelection {
  readonly candidateId: string
  readonly ticker: string
  readonly name: string
  readonly allocationPct: number
}

interface PlanState {
  readonly candidates: ReadonlyArray<StrategyCandidate>
  readonly selections: ReadonlyArray<PlanSelection>
  readonly evaluation: StrategyEvaluation | null
  readonly draft: StrategyDraft | null
  readonly loading: boolean
  readonly evaluating: boolean
  readonly error: string | null
  readonly sessionId: string | null
}

export interface UsePlanReturn extends PlanState {
  readonly addCandidate: (id: string, allocation?: number) => void
  readonly removeCandidate: (id: string) => void
  readonly updateAllocation: (id: string, pct: number) => void
  readonly markReviewed: () => void
}

interface DraftResponse {
  readonly success: boolean
  readonly data?: StrategyDraft
  readonly error?: string
}

interface EvalResponse {
  readonly success: boolean
  readonly data?: StrategyEvaluation
  readonly error?: string
}

interface SessionResponse {
  readonly success: boolean
  readonly data?: PlanSession
  readonly error?: string
}

const AUTO_SAVE_DELAY_MS = 1000

function buildScenarioItems(
  selections: ReadonlyArray<PlanSelection>,
  candidates: ReadonlyArray<StrategyCandidate>,
): ReadonlyArray<StrategyScenarioItem> {
  return selections.map((s): StrategyScenarioItem => {
    const candidate = candidates.find((c) => c.id === s.candidateId)
    return {
      candidateId: s.candidateId,
      ticker: s.ticker,
      name: s.name,
      type: candidate?.type ?? 'etf',
      rationale: candidate?.rationale ?? '',
      confidence: candidate?.confidence ?? 0.5,
      expectedMitigationCad: candidate?.expectedMitigationCad ?? 0,
      diversificationScore: candidate?.diversificationScore ?? 0,
      estimatedTurnoverCostCad: candidate?.estimatedTurnoverCostCad ?? 0,
      estimatedTaxCostCad: candidate?.estimatedTaxCostCad ?? 0,
      allocationPct: s.allocationPct,
    }
  })
}

export function usePlan(
  userId: string,
  signalId: string | undefined,
  restoreSessionId?: string | null,
): UsePlanReturn {
  const [state, setState] = useState<PlanState>({
    candidates: [],
    selections: [],
    evaluation: null,
    draft: null,
    loading: true,
    evaluating: false,
    error: null,
    sessionId: restoreSessionId ?? null,
  })

  const debounceRef = useRef<number | undefined>(undefined)
  const saveDebounceRef = useRef<number | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(restoreSessionId ?? null)

  // Auto-save helper (fire-and-forget)
  const autoSave = useCallback(
    (
      selections: ReadonlyArray<PlanSelection>,
      evaluation: StrategyEvaluation | null,
      candidates: ReadonlyArray<StrategyCandidate>,
    ) => {
      const sid = sessionIdRef.current
      if (!sid) return

      window.clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = window.setTimeout(() => {
        const scenario = selections.length > 0
          ? { items: buildScenarioItems(selections, candidates) }
          : null

        fetch(`/api/plans/${userId}/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedCandidateIds: selections.map((s) => s.candidateId),
            scenario,
            evaluation,
          }),
        }).catch((err: Error) => {
          // eslint-disable-next-line no-console
          console.warn('Plan auto-save failed:', err.message)
        })
      }, AUTO_SAVE_DELAY_MS)
    },
    [userId],
  )

  // Auto-create session helper
  const ensureSession = useCallback(
    (draft: StrategyDraft | null) => {
      if (sessionIdRef.current || !signalId) return

      fetch(`/api/plans/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalId,
          signalHeadline: draft?.signalHeadline ?? signalId,
        }),
      })
        .then((res) => res.json())
        .then((payload: SessionResponse) => {
          if (payload.success && payload.data) {
            sessionIdRef.current = payload.data.id
            setState((prev) => ({ ...prev, sessionId: payload.data!.id }))
          }
        })
        .catch((err: Error) => {
          // eslint-disable-next-line no-console
          console.warn('Plan session creation failed:', err.message)
        })
    },
    [userId, signalId],
  )

  // Restore session from server if sessionId provided
  useEffect(() => {
    if (!restoreSessionId || !signalId) return

    const controller = new AbortController()

    // Fetch saved session AND fresh draft in parallel
    Promise.all([
      fetch(`/api/plans/${userId}/${restoreSessionId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/strategy/${userId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
        signal: controller.signal,
      }).then((r) => r.json()),
    ])
      .then(([sessionPayload, draftPayload]: [SessionResponse, DraftResponse]) => {
        if (!sessionPayload.success || !sessionPayload.data) {
          throw new Error(sessionPayload.error ?? 'Failed to restore session')
        }
        if (!draftPayload.success || !draftPayload.data) {
          throw new Error(draftPayload.error ?? 'Failed to load strategy candidates')
        }

        const session = sessionPayload.data
        const draftData = draftPayload.data

        // Restore selections from saved session
        const restoredSelections: ReadonlyArray<PlanSelection> = session.selectedCandidateIds
          .map((cid) => {
            const candidate = draftData.candidates.find((c) => c.id === cid)
            const scenarioItem = session.scenario?.items.find((item) => item.candidateId === cid)
            if (!candidate) return null
            return {
              candidateId: cid,
              ticker: candidate.ticker,
              name: candidate.name,
              allocationPct: scenarioItem?.allocationPct ?? candidate.proposedShiftPct,
            }
          })
          .filter((s): s is PlanSelection => s !== null)

        setState({
          candidates: draftData.candidates,
          draft: draftData,
          selections: restoredSelections,
          evaluation: session.evaluation,
          loading: false,
          evaluating: false,
          error: null,
          sessionId: session.id,
        })
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setState((prev) => ({ ...prev, loading: false, error: err.message }))
      })

    return () => controller.abort()
  }, [userId, signalId, restoreSessionId])

  // Fetch draft on mount (only when NOT restoring a session)
  useEffect(() => {
    if (!signalId || restoreSessionId) return

    const controller = new AbortController()
    abortRef.current = controller

    fetch(`/api/strategy/${userId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((payload: DraftResponse) => {
        if (!payload.success || !payload.data) {
          throw new Error(payload.error ?? 'Failed to load strategy candidates')
        }
        setState((prev) => ({
          ...prev,
          candidates: payload.data!.candidates,
          draft: payload.data!,
          loading: false,
        }))
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setState((prev) => ({ ...prev, loading: false, error: err.message }))
      })

    return () => controller.abort()
  }, [userId, signalId, restoreSessionId])

  const evaluate = useCallback(
    (selections: ReadonlyArray<PlanSelection>) => {
      if (selections.length === 0) {
        setState((prev) => ({ ...prev, evaluation: null, evaluating: false }))
        return
      }

      window.clearTimeout(debounceRef.current)

      debounceRef.current = window.setTimeout(() => {
        setState((prev) => ({ ...prev, evaluating: true }))

        const scenario = { items: buildScenarioItems(selections, state.candidates) }

        fetch(`/api/strategy/${userId}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signalId, scenario }),
        })
          .then((res) => res.json())
          .then((payload: EvalResponse) => {
            if (!payload.success || !payload.data) {
              throw new Error(payload.error ?? 'Evaluation failed')
            }
            setState((prev) => {
              const next = { ...prev, evaluation: payload.data!, evaluating: false }
              autoSave(prev.selections, payload.data!, prev.candidates)
              return next
            })
          })
          .catch((err: Error) => {
            setState((prev) => ({ ...prev, evaluating: false, error: err.message }))
          })
      }, 300)
    },
    [signalId, state.candidates, userId, autoSave],
  )

  const addCandidate = useCallback(
    (id: string, allocation?: number) => {
      setState((prev) => {
        if (prev.selections.some((s) => s.candidateId === id)) return prev
        const candidate = prev.candidates.find((c) => c.id === id)
        if (!candidate) return prev

        // Auto-create session on first add
        if (prev.selections.length === 0) {
          ensureSession(prev.draft)
        }

        const newSelection: PlanSelection = {
          candidateId: id,
          ticker: candidate.ticker,
          name: candidate.name,
          allocationPct: allocation ?? candidate.proposedShiftPct,
        }
        const next = [...prev.selections, newSelection]
        evaluate(next)
        return { ...prev, selections: next }
      })
    },
    [evaluate, ensureSession],
  )

  const removeCandidate = useCallback(
    (id: string) => {
      setState((prev) => {
        const next = prev.selections.filter((s) => s.candidateId !== id)
        evaluate(next)
        return { ...prev, selections: next }
      })
    },
    [evaluate],
  )

  const updateAllocation = useCallback(
    (id: string, pct: number) => {
      setState((prev) => {
        const next = prev.selections.map((s) =>
          s.candidateId === id ? { ...s, allocationPct: pct } : s,
        )
        evaluate(next)
        return { ...prev, selections: next }
      })
    },
    [evaluate],
  )

  const markReviewed = useCallback(() => {
    const sid = sessionIdRef.current
    if (!sid) return

    fetch(`/api/plans/${userId}/${sid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    }).catch((err: Error) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to mark plan as reviewed:', err.message)
    })
  }, [userId])

  return { ...state, addCandidate, removeCandidate, updateAllocation, markReviewed }
}
