import { useCallback, useState } from 'react'
import type {
  CreateWorkspaceBranchRequest,
  CreateWorkspaceCheckpointRequest,
  CreateWorkspaceSessionRequest,
  UpdateWorkspaceBranchRequest,
  UpdateWorkspaceSessionRequest,
  WorkspaceBranch,
  WorkspaceBranchCompare,
  WorkspaceCheckpoint,
  WorkspaceOperation,
  WorkspaceSession,
  WorkspaceSessionBundle,
  WorkspaceSnapshot,
} from '../types/workspace'
import type { WorkspaceEnvelope } from '../types/workspace'

interface WorkspaceSessionsState {
  readonly sessions: ReadonlyArray<WorkspaceSession>
  readonly activeBundle: WorkspaceSessionBundle | null
  readonly loading: boolean
  readonly error: string | null
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as WorkspaceEnvelope<T>
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? `Workspace request failed (${response.status})`)
  }
  return payload.data
}

export function useWorkspaceSessions(userId: string): WorkspaceSessionsState & {
  readonly refreshSessions: () => Promise<ReadonlyArray<WorkspaceSession>>
  readonly loadSession: (sessionId: string) => Promise<WorkspaceSessionBundle | null>
  readonly createSession: (request: CreateWorkspaceSessionRequest) => Promise<WorkspaceSessionBundle | null>
  readonly updateSession: (
    sessionId: string,
    request: UpdateWorkspaceSessionRequest,
  ) => Promise<WorkspaceSession | null>
  readonly createBranch: (
    sessionId: string,
    request: CreateWorkspaceBranchRequest,
  ) => Promise<WorkspaceBranch | null>
  readonly updateBranch: (
    sessionId: string,
    branchId: string,
    request: UpdateWorkspaceBranchRequest,
  ) => Promise<WorkspaceBranch | null>
  readonly createCheckpoint: (
    sessionId: string,
    request: CreateWorkspaceCheckpointRequest,
  ) => Promise<WorkspaceCheckpoint | null>
  readonly restoreCheckpoint: (
    sessionId: string,
    checkpointId: string,
  ) => Promise<WorkspaceCheckpoint | null>
  readonly compareBranches: (
    sessionId: string,
    leftBranchId: string,
    rightBranchId: string,
  ) => Promise<WorkspaceBranchCompare | null>
  readonly appendOperation: (
    sessionId: string,
    request: {
      readonly branchId: string
      readonly type: WorkspaceOperation['type']
      readonly payload?: Record<string, unknown>
      readonly actor?: WorkspaceOperation['actor']
      readonly snapshot?: WorkspaceSnapshot
    },
  ) => Promise<WorkspaceOperation | null>
  readonly setActiveBundle: (bundle: WorkspaceSessionBundle | null) => void
} {
  const [state, setState] = useState<WorkspaceSessionsState>({
    sessions: [],
    activeBundle: null,
    loading: false,
    error: null,
  })

  const refreshSessions = useCallback(async (): Promise<ReadonlyArray<WorkspaceSession>> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/workspace/${userId}/sessions`)
      const sessions = await parseEnvelope<ReadonlyArray<WorkspaceSession>>(response)
      setState((prev) => ({ ...prev, sessions, loading: false, error: null }))
      return sessions
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workspace sessions'
      setState((prev) => ({ ...prev, loading: false, error: message }))
      return []
    }
  }, [userId])

  const loadSession = useCallback(async (sessionId: string): Promise<WorkspaceSessionBundle | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}`)
      const bundle = await parseEnvelope<WorkspaceSessionBundle>(response)
      setState((prev) => ({ ...prev, activeBundle: bundle, loading: false, error: null }))
      return bundle
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workspace session'
      setState((prev) => ({ ...prev, loading: false, error: message }))
      return null
    }
  }, [userId])

  const createSession = useCallback(async (request: CreateWorkspaceSessionRequest): Promise<WorkspaceSessionBundle | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/workspace/${userId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const bundle = await parseEnvelope<WorkspaceSessionBundle>(response)
      setState((prev) => ({
        ...prev,
        activeBundle: bundle,
        sessions: [bundle.session, ...prev.sessions.filter((entry) => entry.id !== bundle.session.id)],
        loading: false,
        error: null,
      }))
      return bundle
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create workspace session'
      setState((prev) => ({ ...prev, loading: false, error: message }))
      return null
    }
  }, [userId])

  const updateSession = useCallback(
    async (sessionId: string, request: UpdateWorkspaceSessionRequest): Promise<WorkspaceSession | null> => {
      try {
        const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const session = await parseEnvelope<WorkspaceSession>(response)
        setState((prev) => ({
          ...prev,
          sessions: prev.sessions.map((entry) => (entry.id === session.id ? session : entry)),
          activeBundle:
            prev.activeBundle?.session.id === session.id
              ? { ...prev.activeBundle, session }
              : prev.activeBundle,
        }))
        return session
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update session'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const createBranch = useCallback(
    async (sessionId: string, request: CreateWorkspaceBranchRequest): Promise<WorkspaceBranch | null> => {
      try {
        const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}/branches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const branch = await parseEnvelope<WorkspaceBranch>(response)
        setState((prev) => {
          if (prev.activeBundle?.session.id !== sessionId) return prev
          return {
            ...prev,
            activeBundle: {
              ...prev.activeBundle,
              branches: [...prev.activeBundle.branches, branch],
            },
          }
        })
        return branch
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create branch'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const updateBranch = useCallback(
    async (
      sessionId: string,
      branchId: string,
      request: UpdateWorkspaceBranchRequest,
    ): Promise<WorkspaceBranch | null> => {
      try {
        const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}/branches/${branchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const branch = await parseEnvelope<WorkspaceBranch>(response)
        setState((prev) => {
          if (prev.activeBundle?.session.id !== sessionId) return prev
          return {
            ...prev,
            activeBundle: {
              ...prev.activeBundle,
              branches: prev.activeBundle.branches.map((entry) =>
                entry.id === branch.id ? branch : entry,
              ),
            },
          }
        })
        return branch
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update branch'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const createCheckpoint = useCallback(
    async (
      sessionId: string,
      request: CreateWorkspaceCheckpointRequest,
    ): Promise<WorkspaceCheckpoint | null> => {
      try {
        const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}/checkpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const checkpoint = await parseEnvelope<WorkspaceCheckpoint>(response)
        setState((prev) => {
          if (prev.activeBundle?.session.id !== sessionId) return prev
          return {
            ...prev,
            activeBundle: {
              ...prev.activeBundle,
              checkpoints: [checkpoint, ...prev.activeBundle.checkpoints],
            },
          }
        })
        return checkpoint
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create checkpoint'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const restoreCheckpoint = useCallback(
    async (sessionId: string, checkpointId: string): Promise<WorkspaceCheckpoint | null> => {
      try {
        const response = await fetch(
          `/api/workspace/${userId}/sessions/${sessionId}/restore/${checkpointId}`,
          {
            method: 'POST',
          },
        )
        const checkpoint = await parseEnvelope<WorkspaceCheckpoint>(response)
        return checkpoint
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to restore checkpoint'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const compareBranches = useCallback(
    async (
      sessionId: string,
      leftBranchId: string,
      rightBranchId: string,
    ): Promise<WorkspaceBranchCompare | null> => {
      try {
        const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftBranchId, rightBranchId }),
        })
        const result = await parseEnvelope<WorkspaceBranchCompare>(response)
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to compare branches'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const appendOperation = useCallback(
    async (
      sessionId: string,
      request: {
        readonly branchId: string
        readonly type: WorkspaceOperation['type']
        readonly payload?: Record<string, unknown>
        readonly actor?: WorkspaceOperation['actor']
        readonly snapshot?: WorkspaceSnapshot
      },
    ): Promise<WorkspaceOperation | null> => {
      try {
        const response = await fetch(`/api/workspace/${userId}/sessions/${sessionId}/operations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const operation = await parseEnvelope<WorkspaceOperation>(response)
        return operation
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to append operation'
        setState((prev) => ({ ...prev, error: message }))
        return null
      }
    },
    [userId],
  )

  const setActiveBundle = useCallback((bundle: WorkspaceSessionBundle | null) => {
    setState((prev) => ({ ...prev, activeBundle: bundle }))
  }, [])

  return {
    ...state,
    refreshSessions,
    loadSession,
    createSession,
    updateSession,
    createBranch,
    updateBranch,
    createCheckpoint,
    restoreCheckpoint,
    compareBranches,
    appendOperation,
    setActiveBundle,
  }
}
