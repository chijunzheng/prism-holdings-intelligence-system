// Session management hook for multi-agent analysis sessions.
// Each signal analysis creates a session visible in the left panel.

import { useCallback, useEffect, useState } from 'react'

export type SessionSummary = {
  readonly id: string
  readonly type: 'signal' | 'portfolio_review' | 'holding' | 'general'
  readonly title: string
  readonly signalId?: string
  readonly status: 'pending' | 'analyzing' | 'checkpoint' | 'complete' | 'error'
  readonly messageCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

interface UseSessionsReturn {
  readonly sessions: readonly SessionSummary[]
  readonly activeSessionId: string | null
  readonly isLoading: boolean
  readonly createSession: (params: {
    type: SessionSummary['type']
    title: string
    signalId?: string
  }) => Promise<string>
  readonly updateSession: (sessionId: string, params: {
    title?: string
    status?: SessionSummary['status']
  }) => void
  readonly selectSession: (sessionId: string | null) => void
  readonly deleteSession: (sessionId: string) => Promise<void>
}

export function useSessions(userId: string): UseSessionsReturn {
  const [sessions, setSessions] = useState<readonly SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch sessions on mount and userId change
  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/v2/sessions/${userId}`)
      .then((res) => res.json())
      .then((payload: { success: boolean; data?: SessionSummary[] }) => {
        if (payload.success && payload.data) {
          setSessions(payload.data)
        }
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [userId])

  const createSession = useCallback(
    async (params: { type: SessionSummary['type']; title: string; signalId?: string }) => {
      const res = await fetch(`/api/v2/sessions/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const payload = await res.json() as { success: boolean; data?: { id: string } }
      if (!payload.success || !payload.data) {
        throw new Error('Failed to create session')
      }

      const newId = payload.data.id
      // Refresh sessions list
      const listRes = await fetch(`/api/v2/sessions/${userId}`)
      const listPayload = await listRes.json() as { success: boolean; data?: SessionSummary[] }
      if (listPayload.success && listPayload.data) {
        setSessions(listPayload.data)
      }
      setActiveSessionId(newId)
      return newId
    },
    [userId],
  )

  const updateSession = useCallback(
    (sessionId: string, params: { title?: string; status?: SessionSummary['status'] }) => {
      // Optimistic local update
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, ...(params.title ? { title: params.title } : {}), ...(params.status ? { status: params.status } : {}) }
            : s,
        ),
      )

      // Fire-and-forget PATCH to server
      fetch(`/api/v2/sessions/${userId}/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).catch(() => {
        // Silently ignore — optimistic update already applied
      })
    },
    [userId],
  )

  const selectSession = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId)
  }, [])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/v2/sessions/${userId}/${sessionId}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
    },
    [activeSessionId, userId],
  )

  return { sessions, activeSessionId, isLoading, createSession, updateSession, selectSession, deleteSession }
}
