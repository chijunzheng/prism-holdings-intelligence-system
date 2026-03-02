// Candidate management hook for watchlist/planned changes.
// Follows the same pattern as useSessions.

import { useCallback, useEffect, useState } from 'react'
import type { Candidate, RecommendationAction } from '@prism/shared'

interface UseCandidatesReturn {
  readonly candidates: readonly Candidate[]
  readonly loading: boolean
  readonly fetchCandidates: () => Promise<void>
  readonly addCandidate: (params: Omit<Candidate, 'id' | 'userId' | 'status' | 'createdAt'>) => Promise<void>
  readonly updateCandidate: (id: string, status: Candidate['status']) => void
  readonly removeCandidate: (id: string) => Promise<void>
  readonly saveFromRecommendation: (params: {
    recommendationId: string
    sourceLabel: string
    sourceSignalId?: string
    actions: readonly RecommendationAction[]
  }) => Promise<void>
  readonly previewPlan: () => Promise<unknown>
}

export function useCandidates(userId: string): UseCandidatesReturn {
  const [candidates, setCandidates] = useState<readonly Candidate[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v2/candidates/${userId}`)
      const payload = await res.json() as { success: boolean; data?: Candidate[] }
      if (payload.success && payload.data) {
        setCandidates(payload.data)
      }
    } catch {
      // Silently handle fetch errors
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void fetchCandidates()
  }, [fetchCandidates])

  const addCandidate = useCallback(
    async (params: Omit<Candidate, 'id' | 'userId' | 'status' | 'createdAt'>) => {
      const res = await fetch(`/api/v2/candidates/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const payload = await res.json() as { success: boolean; data?: Candidate }
      if (payload.success && payload.data) {
        setCandidates((prev) => [payload.data!, ...prev])
      }
    },
    [userId],
  )

  const updateCandidate = useCallback(
    (id: string, status: Candidate['status']) => {
      // Optimistic update
      setCandidates((prev) =>
        status === 'dismissed'
          ? prev.filter((c) => c.id !== id)
          : prev.map((c) => (c.id === id ? { ...c, status } : c)),
      )

      fetch(`/api/v2/candidates/${userId}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch(() => {
        // Revert on failure
        void fetchCandidates()
      })
    },
    [userId, fetchCandidates],
  )

  const removeCandidate = useCallback(
    async (id: string) => {
      setCandidates((prev) => prev.filter((c) => c.id !== id))
      await fetch(`/api/v2/candidates/${userId}/${id}`, { method: 'DELETE' })
    },
    [userId],
  )

  const saveFromRecommendation = useCallback(
    async (params: {
      recommendationId: string
      sourceLabel: string
      sourceSignalId?: string
      actions: readonly RecommendationAction[]
    }) => {
      // Optimistic local update — show candidates immediately
      const optimistic: Candidate[] = params.actions.map((action, i) => ({
        id: `optimistic-${Date.now()}-${i}`,
        userId,
        ticker: action.ticker,
        name: action.name,
        action: action.action,
        suggestedChangeCad: action.suggestedChangeCad,
        suggestedChangePct: action.suggestedChangePct,
        rationale: action.rationale,
        status: 'planned' as const,
        sourceSignalId: params.sourceSignalId,
        sourceRecommendationId: params.recommendationId,
        sourceLabel: params.sourceLabel,
        createdAt: new Date().toISOString(),
      }))
      setCandidates((prev) => [...optimistic, ...prev])

      try {
        const res = await fetch(`/api/v2/candidates/${userId}/from-recommendation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recommendationId: params.recommendationId,
            sourceLabel: params.sourceLabel,
            sourceSignalId: params.sourceSignalId,
            actions: params.actions,
          }),
        })
        const payload = await res.json() as { success: boolean; data?: Candidate[] }
        if (payload.success && payload.data) {
          // Replace optimistic entries with real server-assigned IDs
          const optimisticIds = new Set(optimistic.map((o) => o.id))
          setCandidates((prev) => [
            ...payload.data!,
            ...prev.filter((c) => !optimisticIds.has(c.id)),
          ])
        }
      } catch {
        // Revert optimistic update on failure
        void fetchCandidates()
      }
    },
    [userId, fetchCandidates],
  )

  const previewPlan = useCallback(async () => {
    const res = await fetch(`/api/v2/candidates/${userId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const payload = await res.json() as { success: boolean; data?: unknown }
    return payload.data
  }, [userId])

  return {
    candidates,
    loading,
    fetchCandidates,
    addCandidate,
    updateCandidate,
    removeCandidate,
    saveFromRecommendation,
    previewPlan,
  }
}
